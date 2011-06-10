var express = require('express');
var io = require('socket.io');
var sio = require('socket.io-sessions');
var sys = require('sys');
var twitter = require('./lib/vendor/twitter');
var url = require('url');

var key = "c52uegTrRkDob3kRuw"; //consumer key
var secret = "Vxp5DUSZSM9LSpzNUAUXcH6eWImk4B2eV4Ookt7ak"; //consumer secret

var port = 8080;

var startup_count = 50; //initial amount of tweets to grab before we start streaming

var storage_fingerprint = "";
var storage_secret = "youshouldchangethisvalue";

var supported_transports = [
	'websocket',
	'xhr-multipart',
	'xhr-polling'
];

var use_gzip = true;

var server = module.exports = express.createServer();

var storage = new express.session.MemoryStore();
var socket = sio.enable(
{
	socket: io.listen(server, {transports: supported_transports}),
	store: storage,
	parser: express.cookieParser()
});

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
	server.use(express.errorHandler({dumpExceptions:true,showStack:true})); 
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
		res.render('home.jade',
		{
			locals: { 
				timestamp: (new Date()).getTime()
			},
			title: 'hello @'+req.session.oauth._results.screen_name+'!'
		});
	}
});

server.get('/oauth/login', function(req, res)
{
	var tw = new twitter(key, secret);
	tw.getRequestToken(function(error, url)
	{
		if(error)
		{
			req.session.destroy(function()
			{
				console.error(error);
				res.writeHead(500, {'Content-Type': 'text/html'});
				res.send("there was an issue building the url..<a href='/'>return</a>");
			});
		}
		else
		{
			req.session.oauth = tw;
			res.redirect(url);
		}
	});
});

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
					console.error(error);
					res.send("there was an issue getting the token..<a href='/'>return</a>");
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
	console.log('Express server listening on port '+server.address().port);
}

if (use_gzip)
{
	var gzip = require('connect-gzip');
	gzip.gzip({matchType: /css/});
	gzip.gzip({matchType: /js/});
}

/*
 * the socket connection event which gets the gears started
 */
socket.on('sconnection', function(client, session)
{
	if (typeof(session) === "undefined")
	{
		console.log("User connected to socket.io without any oauth info, ignoring");
	}
	else
	{
		try
		{
			var tw = new twitter(key, secret, session.oauth);
			z_engine_streaming_handler(tw, client, session);
		}
		catch(e)
		{
			console.error('ERROR: ' + e);
		}
	}
});

socket.on('sinvalid', function(client)
{
	console.error('Client connected with an invalid session id, ignoring');
});

/*
 * callback function to handle message based events coming from our client via websocket
 */
function z_engine_message_handler(this_session, client, message, tw)
{
	if (message.status)
	{
		tw.update(message.status, function(error, data, response)
		{
			if(error)
			{
				console.error("UPDATE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
	else if (message.destroy)
	{
		tw.destroy(message.destroy.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("DELETE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
	else if (message.destroy_dm)
	{
		tw.destroy_dm(message.destroy_dm.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("DELETE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
	else if (message.direct_message)
	{
		tw.direct_message(message.direct_message, function(error, data, response)
		{
			if(error)
			{
				console.error("UPDATE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
	else if (message.fetch)
	{
		switch (message.fetch)
		{
			case 'dms-inbox':
				z_engine_static_timeline_fetch(this_session, tw, client, {count: startup_count, include_entities: true}, "dms-inbox");
			break;
			case 'dms-outbox':
				z_engine_static_timeline_fetch(this_session, tw, client, {count: startup_count, include_entities: true}, "dms-outbox");
			break;
			case 'home':
				z_engine_static_timeline_fetch(this_session, tw, client, {type: 'home_timeline', count: startup_count, include_entities: true}, "home");
			break;
			case 'mentions':
				z_engine_static_timeline_fetch(this_session, tw, client, {type: 'mentions', count: startup_count, include_entities: true}, "mentions");
			break;
			case 'retweets':
				z_engine_static_timeline_fetch(this_session, tw, client, {type: 'retweeted_of_me', count: startup_count, include_entities: true}, "retweets");
			break;
		}
	}
	else if (message.favorite)
	{
		tw.favorite(message.favorite.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("FAVORITE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
	else if (message.retweet)
	{
		tw.retweet(message.retweet.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("RETWEET ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
			else
			{
				client.send({retweet_info: data});
			}
		});
	}
	else if (message.unfavorite)
	{
		tw.unfavorite(message.unfavorite.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("UNFAVORITE ERROR\ndata: "+sys.inspect(data)+'response: '+sys.inspect(response)+'oauth: '+tw+'message: '+sys.inspect(message));
			}
		});
	}
}

/*
 *
 */
function z_engine_streaming_handler(tw, client, session)
{
	client.send({loaded: true});
	client.send({info: 
	{
		oauth_token: session.oauth._token,
		oauth_secret: session.oauth._secret,
		screen_name: session.oauth._results.screen_name,
		user_id: session.oauth._results.user_id
	}});
	setTimeout(function()
	{
		var stream = tw.openUserStream({include_entities: true});
		stream.setMaxListeners(0); //dont do this
		stream.on('data', function(data)
		{
			try
			{
				client.send(data);
			}
			catch(e)
			{
				console.error('dispatch event ERROR: ' + data);
			}
		});
		stream.on('error', function(data)
		{
			console.error('UserStream ERROR: ' + data);
		});
		stream.on('end', function()
		{
			console.log('UserStream ends successfully');
		});
		client.on('disconnect', function()
		{
			stream.end();
		});
	},5000);
	client.on('message', function(message)
	{
		if(tw)
		{
			z_engine_message_handler(session, client, message, tw);
		}
	});
}

/*
 * callback function to send static resources via websocket to client
 */
function z_engine_static_timeline_fetch(this_session, tw, client, params, json)
{
	if (json != "dms-inbox" && json != "dms-outbox")
	{
		tw.getTimeline(params, function(error, data, response)
		{
			if(error)
			{
				console.error('TIMELINE ERROR: '+error);
			}
			else
			{
				var out = data.reverse();
				switch (json)
				{
					case 'home':
						client.send(out);
					break;
					case 'mentions':
						client.send({mentions: out});
					break;
					case 'retweets':
						client.send({retweets: out});
					break;
				}
			}
		});
	}
	else
	{
		if (json == "dms-inbox")
		{
			tw.getInbox(params, function(error, data, response)
			{
				if(error)
				{
					console.error('TIMELINE ERROR: '+error);
				}
				else
				{
					client.send({dms: data.reverse()});
				}
			});
		}
		else if (json == "dms-outbox")
		{
			tw.getOutbox(params, function(error, data, response)
			{
				if(error)
				{
					console.error('TIMELINE ERROR: '+error);
				}
				else
				{
					client.send({dms: data.reverse()});
				}
			});
		}
	}
}
