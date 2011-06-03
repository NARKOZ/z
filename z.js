var connect = require('connect');
var express = require('express');
var io = require('socket.io');
var sys = require('sys');
var twitter = require('./lib/vendor/twitter');
var url = require('url');

var key = ""; //consumer key
var secret = ""; //consumer secret

var port = 8080;

var startup_count = 50; //initial amount of tweets to grab before we start streaming

var storage_fingerprint = "";
var storage_secret = "";

var supported_transports = [
	'websocket', //tested and working in google chrome / chromium, firefox, and opera (cant test ie from here) :D
	//'flashsocket', //it is recommended you leave this one disabled, no idea how sessions will work out with tihs
	'htmlfile', //untested, might work
	'xhr-multipart', //untested, should work
	'xhr-polling' //untested, should work
];

var use_gzip = true;

var server = module.exports = express.createServer();

var socket = io.listen(server,
{
	transports: supported_transports
});

server.configure(function()
{
	server.set('views', __dirname + '/views');
	server.use(express.cookieParser());
	server.use(express.session({secret: storage_secret, fingerprint: storage_fingerprint, store: new express.session.MemoryStore();}));
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
			title: 'hello @'+req.session.oauth._results.screen_name+'!',
			user: req.session.oauth._results.screen_name
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
				res.send('ERROR :' + error);
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
socket.on('connection', function(client)
{
	var cookie_string = client.request.headers.cookie;
	var parsed_cookies = connect.utils.parseCookie(cookie_string);
	var connect_sid = parsed_cookies['connect.sid'];
	if (!connect_sid)
	{
		console.error('client connected with no sid & tokens');
	}
	else
	{
		storage.get(connect_sid,function(error,this_session)
		{
			if (typeof(this_session) === "undefined")
			{
				console.log("User connected to socket.io without any oauth info, ignoring");
			}
			else
			{
				var tw = new twitter(key,secret,this_session.oauth);
				z_engine_static_timeline_fetch(this_session, tw, client, {type: 'home_timeline', count: startup_count, include_entities: true}, true, "home");
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
							console.error('dispatch event ERROR: ' + e);
						}
					});
					stream.on('error', function(err)
					{
						console.error('UserStream ERROR: ' + err);
					});
					stream.on('end', function()
					{
						console.log('UserStream ends successfully');
					});
					client.on('disconnect', function()
					{
						stream.end();
					});
				},3000);
				client.on('message', function(message)
				{
					if(tw)
					{
						z_engine_message_handler(this_session, client, message, tw);
					}
				});
			}
		});
	}
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
				console.error("UPDATE ERROR\ndata: "+data+'response: '+response+'oauth: '+tw+'message: '+message);
			}
		});
	}
	else if (message.favorite)
	{
		tw.favorite(message.favorite.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("FAVORITE ERROR\ndata: "+data+'response: '+response+'oauth: '+tw+'message: '+message);
			}
		});
	}
	else if (message.unfavorite)
	{
		tw.unfavorite(message.unfavorite.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("UNFAVORITE ERROR\ndata: "+data+'response: '+response+'oauth: '+tw+'message: '+message);
			}
		});
	}
	else if (message.retweet)
	{
		tw.retweet(message.retweet.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("RETWEET ERROR\ndata: "+data+'response: '+response+'oauth: '+tw+'message: '+message);
			}
		});
	}
	else if (message.destroy)
	{
		tw.destroy(message.destroy.status.id_str, function(error, data, response)
		{
			if(error)
			{
				console.error("DELETE ERROR\ndata: "+data+'response: '+response+'oauth: '+tw+'message: '+message);
			}
		});
	}
	else if (message.fetch)
	{
		switch (message.fetch)
		{
			case 'mentions':
				z_engine_static_timeline_fetch(this_session, tw, client, {type: 'mentions', count: startup_count, include_entities: true}, false, "mentions");
			break;
		}
	}
}

/*
 * callback function to send static resources via websocket to client
 */
function z_engine_static_timeline_fetch(this_session, tw, client, params, init, json)
{
	tw.getTimeline(params, function(error, data, response)
	{
		if(error)
		{
			console.error('TIMELINE ERROR: '+error);
		}
		else
		{
			if (init)
			{
				client.send({loaded: true});
				client.send({info: {screen_name: this_session.oauth._results.screen_name, user_id: this_session.oauth._results.user_id}});
			}
			switch (json)
			{
				case 'mentions':
					client.send({mentions:  data.reverse()});
				break;
				case 'home':
					client.send(data.reverse());
				break;
			}
		}
	});
}
