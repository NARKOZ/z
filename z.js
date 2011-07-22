/*
 * vars
 */
var config = require('./vendor/config').config;
var express = require('express');
var googl = require('goo.gl');
var gzip = require('connect-gzip');
var io = require('socket.io');
var sio = require('socket.io-sessions');
var site = require('./vendor/sitestreams');
var sys = require('sys');
var user = require('./vendor/clientstreams');

/*
 * these vars are pulled in automatically from config.json
 */
var host = config.host;
googl.setKey(config.googl_key);
var imgur_key = config.imgur_key;
var oauth_callback = config.oauth_callback;
var key = config.oauth_key;
var secret = config.oauth_secret;
var port = config.port;
var sitestream_key = config.oauth_key_sitestream;
var sitestream_access_key = config.oauth_access_key_sitestream;
var sitestream_access_secret = config.oauth_access_secret_sitestream;
var startup_count = config.startup_count;
var storage_fingerprint = config.storage_fingerprint;
var storage_secret = config.storage_secret;
var storage_type = config.storage_type;

/*
 * server
 */
switch (storage_type)
{
	case "couch":
		var CouchStore = require('connect-couchdb')(express);
		var storage =  new CouchStore(
		{
			name: "sessions"
		});
	break;
	case "memory":
		var storage = new express.session.MemoryStore();
	break;
	case "mongo":
		var MongoStore = require('connect-mongo');
		var storage =  new MongoStore(
		{
			db: "sessions"
		});
	break;
	case "redis":
		var RedisStore = require('connect-redis')(express);
		var storage = new RedisStore();
	break;
}
var server = express.createServer();

server.configure(function()
{
	server.set("views", __dirname + "/views");
	server.use(express.cookieParser());
	server.use(express.session({secret: storage_secret, fingerprint: storage_fingerprint, store: storage}));
	server.use(express.bodyParser());
	server.use(express.methodOverride());
	server.use(server.router);
	server.use(express["static"](__dirname+"/public"));
	server.use(express.logger({format: ":method :url"}));
});

server.configure("development", function()
{
	express.logger("development node");
	server.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

server.configure("production", function()
{
	express.logger("production node");
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
server.get("/",function(req, res)
{
	gzip.gzip();
	if (!req.session.oauth)
	{
		res.render("index.jade",
		{
			title: "hello, welcome to z!"
		});
	}
	else
	{
		if (typeof(req.session.oauth._results) == "object")
		{
			res.render("home.jade",
			{
				imgur_script: "var imgur_key = '"+imgur_key+"';",
				title: "hello @"+req.session.oauth._results.screen_name+"!"
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
server.get("/oauth/login", function(req, res)
{
	var tw = new user(key, secret);
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
server.get("/"+oauth_callback, function(req, res)
{
	if (!req.session.oauth)
	{
		res.redirect("/");
	}
	else
	{
		var tw = new user(key, secret, req.session.oauth);
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
server.get("/oauth/logout", function(req, res)
{
	req.session.destroy(function()
	{
		res.redirect("/");
	});
});

if (!module.parent)
{
	if (host == "" && port == 0)
	{
		server.listen();
	}
	else if (host == "" && port != 0)
	{
		server.listen(port);
	}
	else if (host != "" && port != 0)
	{
		server.listen(port, host);
	}
	console.log("z engine running at "+server.address().port);
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

/* some settings that will most certainly be used later on if we can sitestream access */
var connected_clients = new Array();

/* the sessioned socket itself */
var socket = sio.enable(
{
	parser: express.cookieParser(),
	socket: io.listen(server), // <--note the raw io.listen is over yonder
	store: storage
});

/* drop the client from everything */
socket.drop = function (session)
{
	try
	{
		for (var index in connected_clients)
		{
			if (typeof(connected_clients[index].client) == "object" && typeof(connected_clients[index].session) == "object")
			{
				var user_id = connected_clients[index].session.oauth._results.user_id;
				if (user_id == session.oauth._results.user_id)
				{
					if (!sitestream_key && typeof(connected_clients[index].userstream) == "object")
					{
						connected_clients[index].userstream.destroy();
					}
					connected_clients.splice(index, 1);
					break;
				}
			}
		}
	}
	catch (error)
	{
		console.error("socket.drop error: "+error);
	}
	return this;
};

/* safely broadcast to all clients */
socket.megaphone = function (type, message)
{
	try
	{
		for (var index in connected_clients)
		{
			var client = connected_clients[index].client;
			if (client)
			{
				socket.radio(client, type, message)
			}
		}
	}
	catch (error)
	{
		console.error("socket.megaphone error: "+error);
	}
	return this;
};

/* error handling */
socket.on("error", function(error)
{
	if (error.errno === process.ECONNRESET)
	{/* prevent an error from being spit out, this is expected behavior! */}
});

/* the socket connection event which gets the gears started */
socket.on("sconnection", function(client, session)
{
	if (typeof(session.oauth) == "object")
	{
		try
		{
			var tw = new user(key, secret, session.oauth);
		}
		catch (error)
		{
			console.error("user oauth session issue: "+error);
		}
		if(tw)
		{
			try
			{
				connected_clients[session.oauth._results.user_id] = {client: client, session: session};
			}
			catch (error)
			{
				console.error("connected_client error: "+error);
			}
			socket.radio(client, "loaded",
			{
				loaded: true
			});
			socket.radio(client, "info",
			{
				screen_name: session.oauth._results.screen_name,
				user_id: session.oauth._results.user_id
			});
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
			client.on("disconnect", function()
			{
				try
				{
					socket.drop(session);
				}
				catch (error)
				{
					console.error("client disconnect error: "+error);
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
								socket.radiosort(client, "dms-inbox", data);
							}
						});
					break;
					case "dms-outbox":
						tw.getOutbox({count: startup_count, include_entities: true}, function(error, data, response)
						{
							if (!error)
							{
								socket.radiosort(client, "dms-outbox", data);
							}
						});
					break;
					case "home":
						tw.getTimeline({type: "home_timeline", count: startup_count, include_entities: true}, function(error, data, response)
						{
							if (!error)
							{
								socket.radiosort(client, "home", data);
							}
						});
					break;
					case "mentions":
						tw.getTimeline({type: "mentions", count: startup_count, include_entities: true}, function(error, data, response)
						{
							if (!error)
							{
								socket.radiosort(client, "mentions", data);
							}
						});
					break;
					case "rates":
						tw.rateLimit(function(error, data, response)
						{
							if (!error)
							{
								socket.radio(client, "rates", data);
							}
						});
					break;
					case "userstream":
						if (!sitestream_key)
						{
							socket.userstream(tw, client, session);
						}
						else
						{
							//do something here!
						}
					break;
				}
			});
			client.on("retweet", function(json)
			{
				tw.retweet(json.id_str, function(error, data, response)
				{
					if (!error)
					{
						socket.radio(client, "retweet_info", data);
					}
				});
			});
			client.on("shorten", function(json)
			{
				googl.shorten(json.shorten, function (data) 
				{
					socket.radio(client, "shorten", {shortened: data.id, original: json.shorten});
				});
			});
			client.on("show", function(json)
			{
				tw.show(json.id_str, {include_entities: true}, function(error, data, response)
				{
					if (!error)
					{
						socket.radio(client, "show", data);
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
});

/* log to console that an invalid session was found but do nothing further than this */
socket.on("sinvalid", function(client)
{
	//invalid session, just ignore
});

/* broadcast to a single client */
socket.radio = function (client, type, message)
{	try
	{
		client.json.emit(type, message);
	}
	catch (error)
	{
		console.error("socket.radio error: "+error);
	}
	return this;
};

/* sorts the timeline really nicely when a client first connects */
socket.radiosort = function (client, type, data)
{
	try
	{
		for (var index in data)
		{
			setTimeout(function()
			{
				if (client)
				{
					socket.radio(client, type, data.shift()); //we use shift here because we will only send this once
				}
			}, index * 250); //zip through everything and use the index itself to increase the timeout. nice trick eh?
		}
	}
	catch (error) //since there is the chance a client may disconnect before the above finishes, we prevent a crash here
	{
		console.error("socket.radiosort error: "+error);
	}
	return this;
};

/* single sitestream connection */
socket.sitestream = function ()
{
	if (sitestream_key && secret && sitestream_access_key && sitestream_access_secret)
	{
		var connected_clients_sitestream = new Array();
		if (connected_clients.length > 0)
		{
			var sitestream_index = 0;
			for (var index in connected_clients)
			{
				if (index >= 100)
				{
					sitestream_index++;
				}
				if (typeof(connected_clients[index].client) == "object" && typeof(connected_clients[index].session) == "object")
				{
					var found = false;
					var user_id = connected_clients[index].session.oauth._results.user_id;
					for (var index2 in connected_clients_sitestream[sitestream_index]) //make sure this user_id doesnt exist already
					{
						if (connected_clients_sitestream[sitestream_index][index2] == user_id)
						{
							found = true; //if so, we wont add it twice
						}
					}
					if (!found)
					{
						connected_clients_sitestream[sitestream_index].push(user_id);
					}
				}
			}
		}
		try
		{
			var tw = new site(sitestream_key, secret, sitestream_access_key, sitestream_access_secret);
		}
		catch (error)
		{
			console.error("user oauth session issue: "+error);
		}
		for (var index in connected_clients_sitestream[sitestream_index])
		{
			tw.stream("site", {follow: connected_clients_sitestream[index], with: followings, include_entities: true}, function(stream)
			{
				stream.on("data", function (data)
				{
					try
					{
						if (data.for_user && data.message)
						{
							var user_id = data.for_user;
							var payload = data.message;
							var client = connected_clients[user_id].client;
							if (payload.text && payload.created_at && payload.user)
							{
								socket.radio(client, "tweet", payload);
							}
							else if (payload["delete"])
							{
								socket.radio(client, "delete", payload["delete"]);
							}
							else if (payload.direct_message)
							{
								socket.radio(client, "direct_message", payload.direct_message);
							}
							else if (payload.event)
							{
								socket.radio(client, "event", payload);
							}
							else if (payload.friends)
							{
								socket.radio(client, "friends", payload.friends);
							}
						}
					}
					catch(error)
					{
						console.error("socket.sitestream message error: "+error);
					}
				});
				stream.on("error", function(data)
				{
					//
				});
				stream.on("end", function()
				{
					//
				});
			});
		}
	}
	else
	{
		console.log("socket.sitestream error: no sitestream keys");
	}
	return this;
};

/* basic userstream connection,  */
socket.userstream = function (tw, client, session)
{
	if (typeof(connected_clients[session.oauth._results.user_id].userstream) == "undefined")
	{
		tw.stream("user", {include_entities: true}, function(stream)
		{
			connected_clients[session.oauth._results.user_id].userstream = stream;
			stream.on("data", function (data)
			{
				try
				{
					if (data.text && data.created_at && data.user)
					{
						socket.radio(client, "tweet", data);
					}
					else if (data["delete"])
					{
						socket.radio(client, "delete", data["delete"]);
					}
					else if (data.direct_message)
					{
						socket.radio(client, "direct_message", data.direct_message);
					}
					else if (data.event)
					{
						socket.radio(client, "event", data);
					}
					else if (data.friends)
					{
						socket.radio(client, "friends", data.friends);
					}
				}
				catch(error)
				{
					console.error("socket.userstream message error: "+error);
				}
			});
			stream.on("error", function(data)
			{
				socket.radio(client, "server_error", {event: "error"});
			});
			stream.on("end", function()
			{
				socket.radio(client, "server_error", {event: "end"});
			});
		});
	}
	else
	{
		socket.drop(session); //close the previous stream
		socket.userstream(tw, client, session); //loop through here again
	}
	return this;
};
