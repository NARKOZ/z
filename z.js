/*
 * vars
 */
var config = require('./vendor/config').config;
var express = require('express');
var googl = require('./vendor/googl');
var gzip = require('connect-gzip');
var site = require('./vendor/sitestreams');
var sys = require('sys');
var user = require('./vendor/clientstreams');

/*
 * these vars are pulled in automatically from config.json
 */
var host = config.host;
googl.setKey(config.googl_key); //we arent reusing this at any point, just set it here
var imgur_key = config.imgur_key;
var oauth_callback = config.oauth_callback;
var key = config.oauth_key;
var secret = config.oauth_secret;
var port = config.port;
var sitestream_key = config.oauth_key_sitestream;
var sitestream_secret = config.oauth_secret_sitestream;
var startup_count = config.startup_count;
var redis_host = config.redis_host;
var redis_name = config.redis_name;
var redis_pass = config.redis_pass;
var redis_port = config.redis_port;
var socket_io_version = config.socket_io_version;
var storage_fingerprint = config.storage_fingerprint;
var storage_secret = config.storage_secret;
var storage_type = config.storage_type;

if (socket_io_version != "0.6")
{
	var io = require('socket.io');
	var sio = require('socket.io-sessions');
}
else
{
	//bundled final versions of the 0.6 series of socket.io
	var io = require('./vendor/socket.io');
	var sio = require('./vendor/socket.io/sessions');
}

/*
 * extended storage vars
 */
switch (storage_type)
{
	case "memory":
		var nstore = require("nstore");
		var persistance = nstore.new(__dirname+"/store/sessions.db");
		var storage = new express.session.MemoryStore();
	break;
	case "redis":
		var RedisStore = require('connect-redis')(express);
		var storage = new RedisStore(
		{
			host: redis_host,
			db: redis_name,
			pass: redis_pass,
			port: redis_port
		});
	break;
	//despite code being removed, you could easily add a few lines yourself to support couch, mongo, riak, etc etc :)
}

/*
 * server
 */
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
	if (req.cookies.key && storage_type == "memory")
	{
		persistance.get(req.cookies.key, function (error, this_session)
		{
			if (!error)
			{
				if (typeof(this_session.accessKey) == "string")
				{
					req.session.oauth = this_session;
					res.redirect("/howdy");
				}
			}
		});
	}
	else if (req.session.oauth)
	{
		if (typeof(req.session.oauth.accessKey) == "string")
		{
			res.redirect("/howdy"); //valid session
		}
		else
		{
			res.redirect("/oauth/logout"); //invalid session, restart
		}
	}
	else
	{
		res.render("index.jade",
		{
			title: "hello, welcome to z!"
		});
	}
});

/* authed clients get redirected here */
server.get("/howdy", function(req, res)
{
	gzip.gzip();
	if (!req.session.oauth)
	{
		res.redirect("/");
	}
	else
	{
		res.render("home.jade",
		{
			imgur_script: "var imgur_key = '"+imgur_key+"';",
			title: "hello @"+req.session.oauth._results.screen_name+"!"
		});
	}
});

/* initial logging in */
server.get("/oauth/login", function(req, res)
{
	if (!req.session.oauth)
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
	}
	else
	{
		res.redirect("/howdy");
	}
});

/* destroy all session information (including the id) */
server.get("/oauth/logout", function(req, res)
{
	if (req.session.oauth)
	{
		if (storage_type == "memory")
		{
			persistance.remove(req.cookies.key, function(error)
			{
				return; //do nothing, return
			});
		}
		req.session.destroy();
	}
	if (storage_type == "memory")
	{
		//res.cookie.unset("key"); //this should work but doesnt, whatever
		res.cookie("key", "see-ya", {expires: new Date(Date.now()-86400), httpOnly: true}); //see above, dumb hack
	}
	res.redirect("/");
});

/* oauth callback */
server.get("/"+oauth_callback, function(req, res)
{
	gzip.gzip();
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
					res.send("there was an issue getting the access token...<br /><br /><a href='/'>return</a>");
				});
			}
			else
			{
				if (storage_type == "memory")
				{
					persistance.save(tw.accessKey, tw, function(error)
					{
						if (error)
						{
							console.log("oauth callback save error: "+error);
						}
					});
				}
				req.session.oauth = tw;
				if (storage_type == "memory")
				{
					res.cookie("key", tw.accessKey);
				}
				res.redirect("/howdy");
			}
		});
	}
});

/* determine the best way to listen, if thats even possible */
if (!module.parent)
{
	try
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
	catch (error)
	{
		console.error("bind server listener error: "+error);
	}
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

/* the raw socket.io listener */
if (socket_io_version != "0.6")
{
	var raw_socket = io.listen(server);
}
else
{
	var raw_socket = io.listen(server,
	{
		transports: [
			"xhr-polling" //only support xhr-polling, this is all that seems to work on dotcloud (for example)
		]
	});
}
if (socket_io_version != "0.6")
{
	raw_socket.enable("browser client minification");
	raw_socket.configure("production", function()
	{
		raw_socket.enable("browser client etag");
		raw_socket.set("log level", 1);
	});
	raw_socket.configure("development", function()
	{
		raw_socket.set("log level", 3);
	});
}

/* the socket.io session listener - there are not two listeners, rather this extends the above instance */
var socket = sio.enable(
{
	parser: express.cookieParser(),
	socket: raw_socket, // <--note the raw io.listen is over yonder
	store: storage
});

/* delete a tweet */
socket.drop_tweet = function (tw, client, json)
{
	try
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
	}
	catch (error)
	{
		console.error("socket.destroy error: "+error);
	}
	return this;
};

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

/* favorite a tweet */
socket.favorite = function (tw, client, json)
{
	try
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
	}
	catch (error)
	{
		console.error("socket.favorite error: "+error);
	}
	return this;
};

/* fetch a resource */
socket.fetch = function (tw, client, session, json)
{
	try
	{
		switch (json)
		{
			case "dms-inbox":
				tw.getInbox({count: startup_count, include_entities: true}, function(error, data, response)
				{
					if (!error)
					{
						socket.radiosort(client, "dms", data);
					}
				});
			break;
			case "dms-outbox":
				tw.getOutbox({count: startup_count, include_entities: true}, function(error, data, response)
				{
					if (!error)
					{
						socket.radiosort(client, "dms", data);
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
					//do something here?
				}
			break;
		}
	}
	catch (error)
	{
		console.error("socket.fetch error: "+error);
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
		if (tw) //ignore any other connections
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
			if (socket_io_version != "0.6")
			{
				client.on("delete", function(json)
				{
					socket.drop_tweet(tw, client, json);
				});
				client.on("favorite", function(json)
				{
					socket.favorite(tw, client, json);
				});
				client.on("fetch", function(json)
				{
					socket.fetch(tw, client, session, json);
				});
				client.on("retweet", function(json)
				{
					socket.retweet(tw, client, json);
				});
				client.on("shorten", function(json)
				{
					socket.shorten(client, json);
				});
				client.on("show", function(json)
				{
					socket.show(tw, client, json);
				});
				client.on("status", function(json)
				{
					socket.status(tw, client, json);
				});
			}
			else
			{
				client.on("message", function(json)
				{
					switch (json.type)
					{
						case "delete":
							socket.drop_tweet(tw. client, json.message);
						break;
						case "favorite":
							socket.favorite(tw, client, json.message);
						break;
						case "fetch":
							socket.fetch(tw, client, session, json.message);
						break;
						case "retweet":
							socket.retweet(tw, client, json.message);
						break;
						case "shorten":
							socket.shorten(client, json.message);
						break;
						case "show":
							socket.show(tw, client, json.message);
						break;
						case "status":
							socket.status(tw, client, json.message);
						break;
					}
				});
			}
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
{
	try
	{
		if (socket_io_version != "0.6")
		{
			client.json.emit(type, message);
		}
		else
		{
			client.send({type: type, message: message});
		}
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

socket.retweet = function (tw, client, json)
{
	try
	{
		tw.retweet(json.id_str, function(error, data, response)
		{
			if (!error)
			{
				socket.radio(client, "retweet_info", data);
			}
		});
	}
	catch (error)
	{
		console.error("socket.retweet error: "+error);
	}
	return this;
};

/* shorten links */
socket.shorten = function (client, json)
{
	try
	{
		googl.shorten(json.shorten, function (data) 
		{
			socket.radio(client, "shorten", {shortened: data.id, original: json.shorten});
		});
	}
	catch (error)
	{
		console.error("socket.shorten error: "+error);
	}
	return this;
};

/* single sitestream connection */
socket.sitestream = function ()
{
	try
	{
		if (key && secret && sitestream_key && sitestream_secret)
		{
			var connected_clients_sitestream = new Array();
			if (connected_clients.length > 0)
			{
				var sitestream_index = 0;
				for (var index in connected_clients)
				{
					if (index++ % 100 == 0)
					{
						sitestream_index++;
					}
					if (typeof(connected_clients[index].client) == "object" && typeof(connected_clients[index].session) == "object")
					{
						var found = false;
						var user_id = connected_clients[index].session.oauth._results.user_id;
						var userstream = false;
						if (typeof(connected_clients[index].userstream) == "object")
						{
							userstream = connected_clients[index].userstream;
						}
						for (var index2 in connected_clients_sitestream[sitestream_index]) //make sure this user_id doesnt exist already
						{
							if (connected_clients_sitestream[sitestream_index][index2] == user_id)
							{
								found = true; //if so, we wont add it twice
							}
						}
						if (!found)
						{
							if (userstream)
							{
								connected_clients[index].userstream.destroy(); //destroy the userstream
							}
							connected_clients_sitestream[sitestream_index].push(user_id); //push this non-duplicate user in
						}
					}
				}
			}
			try
			{
				var tw = new site(key, secret, sitestream_key, sitestream_secret);
			}
			catch (error2)
			{
				console.error("socket.sitestream oauth issue: "+error2);
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
			console.error("socket.sitestream error: no sitestream key & secret");
		}
	}
	catch (error)
	{
		console.error("socket.sitestream error: "+error);
	}
	return this;
};

/* show a specific status */
socket.show = function (tw, client, json)
{
	try
	{
		tw.show(json.id_str, {include_entities: true}, function(error, data, response)
		{
			if (!error)
			{
				socket.radio(client, "show", data);
			}
		});
	}
	catch (error)
	{
		console.error("socket.show error: "+error);
	}
	return this;
};

/* send new status */
socket.status = function (tw, client, json)
{
	try
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
	}
	catch (error)
	{
		console.error("socket.status error: "+error);
	}
	return this;
};

/* basic userstream connection,  */
socket.userstream = function (tw, client, session)
{
	try
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
					catch (error2)
					{
						console.error("socket.userstream message error: "+error2);
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
	}
	catch (error)
	{
		console.error("socket.userstream error: "+error);
	}
};
