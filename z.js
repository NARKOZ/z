/*
 * vars
 */
var config = config = require('./vendor/config').config;
var express = require('express');
var gzip = require('connect-gzip');
var io = require('socket.io');
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

/* settings page */
server.get('/account/settings',function(req, res)
{
	gzip.gzip();
	if (!req.session.oauth)
	{
		res.redirect("/");
	}
	else
	{
		if (typeof(req.session.oauth._results) == "object")
		{
			res.render('settings.jade',
			{
				title: 'settings for @'+req.session.oauth._results.screen_name
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
				z_engine_send(client, {loaded: true});
				z_engine_send(client, {info: 
				{
					screen_name: session.oauth._results.screen_name,
					user_id: session.oauth._results.user_id
				}});
				client.on('message', function(message)
				{
					z_engine_message_handler(tw, session, client, message);
				});
			}
		}
		catch(error)
		{
			console.error('oauth session issue: '+sys.inspect(error));
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

/* callback function to handle message based events coming from our client via websocket */
function z_engine_message_handler(tw, session, client, message)
{
	try
	{
		if (message.status)
		{
			tw.update(message.status);
		}
		else if (message.destroy)
		{
			tw.destroy(message.destroy.status.id_str);
		}
		else if (message.destroy_dm)
		{
			tw.destroy_dm(message.destroy_dm.status.id_str);
		}
		else if (message.direct_message)
		{
			tw.direct_message(message.direct_message);
		}
		else if (message.fetch)
		{
			switch (message.fetch)
			{
				case 'dms-inbox':
					tw.getInbox({count: startup_count, include_entities: true}, function(error, data, response)
					{
						if(!error)
						{
							z_engine_send(client, {dms: data.reverse()});
						}
					});
				break;
				case 'dms-outbox':
					tw.getOutbox({count: startup_count, include_entities: true}, function(error, data, response)
					{
						if(!error)
						{
							z_engine_send(client, {dms: data.reverse()});
						}
					});
				break;
				case 'home':
					tw.getTimeline({type: 'home_timeline', count: startup_count, include_entities: true}, function(error, data, response)
					{
						if(!error)
						{
							z_engine_send(client, {home: data.reverse()});
						}
					});
				break;
				case 'mentions':
					tw.getTimeline({type: 'mentions', count: startup_count, include_entities: true}, function(error, data, response)
					{
						if(!error)
						{
							z_engine_send(client, {mentions: data});
						}
					});
				break;
				case 'rates':
					tw.rateLimit(function(error, data, response)
					{
						if(!error)
						{
							z_engine_send(client, {rates: data});
						}
					});
				break;
				case 'userstream':
					z_engine_streaming_handler(tw, client, session);
				break;
			}
		}
		else if (message.favorite)
		{
			tw.favorite(message.favorite.status.id_str);
		}
		else if (message.klout)
		{
			klout.show(message.klout, function(error, data)
			{
				if(error)
				{
					z_engine_send(client, {klout: "error", id_str: message.id_str});
				}
				else
				{
					z_engine_send(client, {klout: data, id_str: message.id_str});
				}
			});
		}
		else if (message.retweet)
		{
			tw.retweet(message.retweet.status.id_str, function(error, data, response)
			{
				if(!error)
				{
					z_engine_send(client, {retweet_info: data});
				}
			});
		}
		else if (message.shorten)
		{
			shorten.fetch(message.shorten, function(error, data)
			{
				if (!error)
				{
					z_engine_send(client, {shorten: data, original: message.shorten});
				}
			});
		}
		else if (message.show)
		{
			tw.show(message.show.id_str, {include_entities: true}, function(error, data, response)
			{
				if(error)
				{
					console.log(error);
				}
				else
				{
					z_engine_send(client, {show: data});
				}
			});
		}
		else if (message.unfavorite)
		{
			tw.unfavorite(message.unfavorite.status.id_str);
		}
	}
	catch(error)
	{
		console.error('message error: '+sys.inspect(error));
	}
}

/* start and handle the userstream */
function z_engine_streaming_handler(tw, client, session)
{
	if(tw && client && session)
	{
		if (typeof(session.oauth) == "object")
		{
			tw.stream('user', {include_entities: true}, function(stream)
			{
				stream.on('data', function (data)
				{
					try
					{
						z_engine_send(client, data);
					}
					catch(error)
					{
						console.error('userstream message error: '+sys.inspect(error));
					}
				});
				client.on('disconnect', function()
				{
					stream.destroy();
				});
				stream.on('error', function(data)
				{
					z_engine_send(client, {server_event: 'error'});
				});
				stream.on('end', function()
				{
					z_engine_send(client, {server_event: 'end'});
				});
			});
		}
	}
}

function z_engine_send(client, message)
{
	client.json.send(message);
}
