/*
 * vars
 */
var config = config = require('./vendor/config').config;
var express = require('express');
var gzip = require('connect-gzip');
var io = require('socket.io');
var redis = require('redis');
var RedisStore = require('connect-redis')(express);
var sio = require('socket.io-sessions');
var shorten = require('./vendor/shorten')();
var storage = new RedisStore;
var sys = require('sys');
var twitter = require('./vendor/twitter');

/*
 * these vars are pulled in automatically from config.json
 */
var key = config.oauth_key;
var secret = config.oauth_secret;
var sitestream_key = config.oauth_key_sitestream;
var imgur_key = config.imgur_key;
var klout_key = config.klout_key;
var klout = require('./vendor/klout')(klout_key);
var port = config.port;
var startup_count = config.startup_count;
var storage_fingerprint = config.storage_fingerprint;
var storage_secret = config.storage_secret;

/*
 * server
 */
var server = module.exports = express.createServer();

server.configure(function()
{
	server.set('views', __dirname + '/views');
	server.use(express.cookieParser());
	server.use(express.session({secret: storage_secret, fingerprint: storage_fingerprint, store: storage}));
	server.use(express.bodyParser());
	server.use(express.methodOverride());
	server.use(server.router);
	server.use(express['static'](__dirname+'/public'));
	server.use(express.logger({format: ':method :url'}));
});

server.configure('development', function()
{
	express.logger('development node');
	server.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

server.configure('production', function()
{
	express.logger('production node');
	server.use(express.errorHandler());
});

server.dynamicHelpers(
{
	session: function(req, res)
	{
		return req.session;
	}
});

/* index, does some detection on sessions */
server.get('/',function(req, res)
{
	gzip.gzip();
	if (!req.session.oauth)
	{
		res.render('index.jade',
		{
			title: 'hello, welcome to z!'
		});
	}
	else
	{
		if (typeof(req.session.oauth._results) == "object")
		{
			res.render('home.jade',
			{
				imgur_script: "var imgur_key = '"+imgur_key+"';",
				title: 'hello @'+req.session.oauth._results.screen_name+'!'
			});
		}
		else
		{
			req.session.destroy(function()
			{
				res.redirect("/");
			});
		}
	}
});

/* initial logging in */
server.get('/oauth/login', function(req, res)
{
	var tw = new twitter(key, secret);
	tw.getRequestToken(function(error, url)
	{
		if(error)
		{
			req.session.destroy(function()
			{
				res.send("there was an issue building the url...<br /><br /><a href='/'>return</a>");
			});
		}
		else
		{
			req.session.oauth = tw;
			res.redirect(url);
		}
	});
});

/* oauth callback */
server.get('/oauth/callback', function(req, res)
{
	if (!req.session.oauth)
	{
		res.redirect("/");
	}
	else
	{
		var tw = new twitter(key, secret, req.session.oauth);
		tw.getAccessToken(req.query.oauth_verifier, function(error)
		{
			if(error)
			{
				req.session.destroy(function()
				{
					res.send("there was an issue getting the token...<br /><br /><a href='/'>return</a>");
				});
			}
			else
			{
				req.session.oauth = tw;
				res.redirect("/");
			}
		});
	}
});

/* destroy all session information (including the id) */
server.get('/oauth/logout', function(req, res)
{
	req.session.destroy(function()
	{
		res.redirect("/");
	});
});

if (!module.parent)
{
	server.listen(port);
}

/* gzipping */
gzip.gzip({matchType: /audio/});
gzip.gzip({matchType: /css/});
gzip.gzip({matchType: /img/});
gzip.gzip({matchType: /js/});
gzip.gzip({matchType: /lang/});
gzip.gzip({matchType: /socket.io/});

/*
 * socket.io
 */

/* the socket itself */
var socket = sio.enable(
{
	parser: express.cookieParser(),
	socket: io.listen(server),
	store: storage
});

/* the socket connection event which gets the gears started */
socket.on('sconnection', function(client, session)
{
	if (typeof(session.oauth) == "object")
	{
		try
		{
			var tw = new twitter(key, secret, session.oauth);
			if(tw)
			{
				var loaded = {
					loaded: true
				}
				var info = {
					screen_name: session.oauth._results.screen_name,
					user_id: session.oauth._results.user_id
				}
				z_engine_send_to_client(client, "loaded", loaded);
				z_engine_send_to_client(client, "info", info);
				client.on("delete", function(json)
				{
					switch (json.action)
					{
						case "dm":
							tw.destroy_dm(json.id_str);
						break;
						case "tweet":
							tw.destroy(json.id_str);
						break;
					}
				});
				client.on("favorite", function(json)
				{
					switch (json.action)
					{
						case "do":
							tw.favorite(json.id_str);
						break;
						case "undo":
							tw.unfavorite(json.id_str);
						break;
					}
				});
				client.on("fetch", function(message)
				{
					switch (message)
					{
						case "dms-inbox":
							tw.getInbox({count: startup_count, include_entities: true}, function(error, data, response)
							{
								if (!error)
								{
									z_engine_send_to_client(client, "dms", data);
								}
							});
						break;
						case "dms-outbox":
							tw.getOutbox({count: startup_count, include_entities: true}, function(error, data, response)
							{
								if (!error)
								{
									z_engine_send_to_client(client, "dms", data);
								}
							});
						break;
						case "home":
							tw.getTimeline({type: "home_timeline", count: startup_count, include_entities: true}, function(error, data, response)
							{
								if (!error)
								{
									z_engine_send_to_client(client, "home", data);
								}
							});
						break;
						case "mentions":
							tw.getTimeline({type: "mentions", count: startup_count, include_entities: true}, function(error, data, response)
							{
								if (!error)
								{
									z_engine_send_to_client(client, "mentions", data);
								}
							});
						break;
						case "rates":
							tw.rateLimit(function(error, data, response)
							{
								if (!error)
								{
									z_engine_send_to_client(client, "rates", data);
								}
							});
						break;
						case "userstream":
							if (!sitestream_key)
							{
								z_engine_userstream(tw, client);
							}
						break;
					}
				});
				client.on("klout", function(json)
				{
					klout.show(json.klout, function(error, data)
					{
						if (error)
						{
							z_engine_send_to_client(client, "klout", {klout: "error", id_str: json.id_str});
						}
						else
						{
							z_engine_send_to_client(client, "klout", {klout: data, id_str: json.id_str});
						}
					});
				});
				client.on("related", function(json)
				{
					tw.related_results(json.id_str, {count: startup_count, include_entities: true}, function(error, data, response)
					{
						if (!error)
						{
							z_engine_send_to_client(client, "related", {data: data, origin: json.origin});
						}
					});
				});
				client.on("retweet", function(json)
				{
					tw.retweet(json.id_str, function(error, data, response)
					{
						if (!error)
						{
							z_engine_send_to_client(client, "retweet_info", data);
						}
					});
				});
				client.on("shorten", function(json)
				{
					shorten.fetch(json.shorten, function(error, data)
					{
						if (!error)
						{
							z_engine_send_to_client(client, "shorten", {shorten: data, original: json.shorten});
						}
					});
				});
				client.on("show", function(json)
				{
					tw.show(json.id_str, {include_entities: true}, function(error, data, response)
					{
						if (!error)
						{
							z_engine_send_to_client(client, "show", data);
						}
					});
				});
				client.on("status", function(json)
				{
					switch (json.action)
					{
						case "dm":
							tw.direct_message(json.data);
						break;
						case "tweet":
							tw.update(json.data);
						break;
					}
				});
			}
		}
		catch(error)
		{
			console.error("oauth session issue: "+sys.inspect(error));
		}
	}
});

/* log to console that an invalid session was found but do nothing further than this */
socket.on('sinvalid', function(client)
{
	//invalid session, just ignore
});

/* error handling */
socket.on('error', function(error)
{
	if (error.errno === process.ECONNRESET)
	{/* prevent an error from being spit out, this is expected behavior! */}
});

/*
 * globalized functions and vars
 */

var sitestream_clients = new Array();

/* send message to all connected clients */
function z_engine_send_to_all(type, message)
{
	io.sockets.emit(type, message);
}
/* send message to a specific client */
function z_engine_send_to_client(client, type, message)
{
	client.json.emit(type, message);
}

function z_engine_sitestream()
{
	/*var tw = new twitter(key, secret);
	tw.stream("site", {include_entities: true}, function(stream)
	{
		stream.on("data", function (data)
		{
			try
			{
				if (data.text && data.created_at && data.user)
				{
					z_engine_send_to_client(client, "tweet", data);
				}
				else if (data["delete"])
				{
					z_engine_send_to_client(client, "delete", data["delete"]);
				}
				else if (data.direct_message)
				{
					z_engine_send_to_client(client, "direct_message", data.direct_message);
				}
				else if (data.event)
				{
					z_engine_send_to_client(client, "event", data);
				}
				else if (data.friends)
				{
					z_engine_send_to_client(client, "friends", data.friends);
				}
			}
			catch(error)
			{
				console.error("userstream message error: "+sys.inspect(error));
			}
		});
		stream.on("error", function(data)
		{
			z_engine_send_to_client(client, "server_error", {event: "error"});
		});
		stream.on("end", function()
		{
			z_engine_send_to_client(client, "server_error", {event: "end"});
		});
		setInterval(function()
		{
			stream.destroy();
		}, 300 * 1000);
	});*/
}

function z_engine_userstream(tw, client)
{
	tw.stream("user", {include_entities: true}, function(stream)
	{
		stream.on("data", function (data)
		{
			try
			{
				if (data.text && data.created_at && data.user)
				{
					z_engine_send_to_client(client, "tweet", data);
				}
				else if (data["delete"])
				{
					z_engine_send_to_client(client, "delete", data["delete"]);
				}
				else if (data.direct_message)
				{
					z_engine_send_to_client(client, "direct_message", data.direct_message);
				}
				else if (data.event)
				{
					z_engine_send_to_client(client, "event", data);
				}
				else if (data.friends)
				{
					z_engine_send_to_client(client, "friends", data.friends);
				}
			}
			catch(error)
			{
				console.error("userstream message error: "+sys.inspect(error));
			}
		});
		client.on("disconnect", function()
		{
			stream.destroy();
		});
		stream.on("error", function(data)
		{
			z_engine_send_to_client(client, "server_error", {event: "error"});
		});
		stream.on("end", function()
		{
			z_engine_send_to_client(client, "server_error", {event: "end"});
		});
	});
}
