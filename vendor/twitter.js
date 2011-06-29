//originally based on https://github.com/yssk22/node-twbot/,
//reused from https://github.com/kazuyukitanimura/designo
//with help from https://github.com/jdub/node-twitter
var util = require('util'),
	url = require('url'),
	querystring = require('querystring'),
	crypto = require('crypto'),
	http = require('http'),
	EventEmitter = require('events').EventEmitter,
	OAuth = require('oauth').OAuth,
	streamparser = require('./parser');

// for debugging
var debug, debugLevel = parseInt(process.env.NODE_DEBUG, 16);
if (debugLevel & 0x4)
{
	debug = function(x)
	{
		util.error('[twitter]: ' + x);
	};
}
else
{
	debug = function(){};
}

/*
 * OAuth Configuration constants
 */
var OAUTH_CONFIG = {
	RequestTokenUrl: 'https://api.twitter.com/oauth/request_token',
	AccessTokenUrl: 'https://api.twitter.com/oauth/access_token',
	Version: '1.0',
	Method: 'HMAC-SHA1'
};

/*
 * Twitter API endpoint URL
 */
var API_URL = 'https://api.twitter.com/1',
	STREAM_URL = 'https://userstream.twitter.com/2',
	AUTHORIZE_URL = 'https://twitter.com/oauth/authorize?oauth_token=';

/*
 * Twitter API Client
 *
 * @param consumerKey {String} consumerKey OAuth Consumer Key
 * @param consumerSecret {String} consumerSecret OAuth Consumer Secret
 * @param options {Object} API behavior options
 *
 */
function Twitter(consumerKey, consumerSecret, options)
{
	if( !options )
	{
		options = {};
	}
	if(!(this instanceof Twitter))
	{ // enforcing new
		return new Twitter(consumerKey, consumerSecret, options);
	}
	this._oa = new OAuth(
		OAUTH_CONFIG.RequestTokenUrl,
		OAUTH_CONFIG.AccessTokenUrl,
		consumerKey,
		consumerSecret,
		OAUTH_CONFIG.Version,
		null,
		OAUTH_CONFIG.Method
	);
	this.accessKey = options.accessKey;
	this.accessSecret = options.accessSecret;
	this._token = options._token;
	this._token_secret = options._token_secret;
	this._results = options._results;
	this._apiUrl = options._apiUrl || API_URL;
	this._streamUrl = options._streamUrl || STREAM_URL;
}
/*
 * Normalize the error as an Error object.
 *
 * @param err {Object} An object to be normalized
 *
 */
function normalizeError(err)
{
	if(err instanceof Error)
	{
		return err;
	}
	else if(err.statusCode)
	{
		// for 4XX/5XX error
		var e = new Error(err.statusCode + ': ' + err.data);
		e.statusCode = err.statusCode;
		try
		{
			e.data = JSON.parse(err.data);
		}
		catch(er)
		{
			e.data = err.data;
		}
		return e;
	}
	else
	{
		// unknown error
		return new Error(err);
	}
}

/*
 * build the url with the specified path and params.
 *
 * @param path {String} the path string.
 * @param params {Object} (optional) the query parameter object.
 */
function buildUrl(path, params)
{
	var qs;
	if(typeof(params) == 'object')
	{
		qs = querystring.stringify(params);
	}
	return qs ? path + '?' + qs : path;
}

Twitter.prototype.getRequestToken = function(callback)
{
	var self = this;
	this._oa.getOAuthRequestToken(function(err, token, token_secret, results)
	{
		if(err)
		{
			if(callback)
			{
				callback(normalizeError(err));
			}
		}
		else
		{
			self._token = token;
			self._token_secret = token_secret;
			self._token_results = results;
			if(callback)
			{
				callback(null, AUTHORIZE_URL + token);
			}
		}
	});
};

Twitter.prototype.getAccessToken = function(verifier, callback)
{
	var self = this;
	this._oa.getOAuthAccessToken(
		self._token, self._token_secret, verifier,
		function(error, akey, asecret, results2)
		{
			if(error)
			{
				if(callback)
				{
					callback(normalizeError(error));
				}
			}
			else
			{
				self.accessKey = akey;
				self.accessSecret = asecret;
				self._results = results2;
				if(callback)
				{
					callback(null, akey, asecret);
				}
			}
	});
};

// -----------------------------------------------------------------------------
// Tweets Resources
// -----------------------------------------------------------------------------
Twitter.prototype.show = function(id, params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	var path = '/statuses/show/' + id + '.json';
	return this._doGet(path, params, callback);
};

Twitter.prototype.update = function(params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	return this._doPost('/statuses/update.json', params, callback);
};

Twitter.prototype.direct_message = function(params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	return this._doPost('/direct_messages/new.json', params, callback);
};

Twitter.prototype.destroy = function(id, callback)
{
	return this._doPost('/statuses/destroy/' + id + '.json', {}, callback);
};

Twitter.prototype.destroy_dm = function(id, callback)
{
	return this._doPost('/direct_messages/destroy/' + id + '.json', {}, callback);
};

Twitter.prototype.retweet = function(id, callback)
{
	return this._doPost('/statuses/retweet/' + id + '.json', {}, callback);
};

Twitter.prototype.favorite = function(id, callback)
{
	return this._doPost('/favorites/create/' + id + '.json', {}, callback);
};

Twitter.prototype.unfavorite = function(id, callback)
{
	return this._doPost('/favorites/destroy/' + id + '.json', {}, callback);
};

// -----------------------------------------------------------------------------
// Friendship Resources
// -----------------------------------------------------------------------------
Twitter.prototype.follow = function(params, callback)
{
	if(typeof(params) == "string")
	{
		params = {
			user_id: params
		};
	}
	this._doPost('/friendships/create.json', params, callback);
};

Twitter.prototype.unfollow = function(params, callback)
{
	if(typeof(params) == "string")
	{
		params = {
		user_id: params
	};
	}
	this._doPost('/friendships/delete.json', params, callback);
};

Twitter.prototype.followers = function(params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {
			user_id: this._results.user_id
		};
	}
	var path = '/followers/ids.json';
	this._doGet(path, params, callback);
};

Twitter.prototype.following = function(params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {
			user_id: this._results.user_id
		};
	}
	var path = '/friends/ids.json';
	this._doGet(path, params, callback);
};

// -----------------------------------------------------------------------------
// Tweets Resources
// -----------------------------------------------------------------------------
var supportedTLTypes = [
	'public_timeline',
	'home_timeline',
	'friends_timeline',
	'user_timeline',
	'mentions',
	'retweeted_by_me',
	'retweeted_to_me',
	'retweeted_of_me'
];
Twitter.prototype.getTimeline = function(params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {
			type: 'home_timeline'
		};
	}
	else if(typeof(params) == 'string')
	{
		params = {
			type: params
	};
	}
	else if( typeof(params) == 'object')
	{
		params.type = params.type || 'home_timeline';
	}
	else
	{
		throw new TypeError('params must be string or object');
	}
	if( supportedTLTypes.indexOf(params.type) == -1)
	{
		throw new Error('timeline type must be one of (' + supportedTLTypes.join(',') + ') but ' + params.type + '.');
	}
	var path = '/statuses/' + params.type + '.json';
	delete(params.type);
	this._doGet(path, params, callback);
};

Twitter.prototype.getListStatuses = function(user, id, params, callback)
{
	if(typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	var path = ['', user, 'lists', id, 'statuses'].join('/') + '.json';
	this._doGet(path, params, callback);
};

Twitter.prototype.getInbox = function(params, callback)
{
	if( typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	var path = '/direct_messages.json';
	this._doGet(path, params, callback);
};

Twitter.prototype.getOutbox = function(params, callback)
{
	if(typeof(params) == 'function' )
	{
		callback = params;
		params = {};
	}
	var path = '/direct_messages/sent.json';
	this._doGet(path, params, callback);
};

// -----------------------------------------------------------------------------
// Account Resources
// -----------------------------------------------------------------------------
Twitter.prototype.getAccount = function(params, callback)
{
	if( typeof(params) == 'boolean' )
	{
		params = {include_entities: params};
	}
	else if(typeof(params) == 'function')
	{
		callback = params;
		params = {};
	}
	var path = '/account/verify_credentials.json';
	this._doGet(path, params, callback);
};

Twitter.prototype.rateLimit = function(callback)
{
	params = {};
	var path = '/account/rate_limit_status.json';
	this._doGet(path, params, callback);
};


// -----------------------------------------------------------------------------
// Streaming Support
// -----------------------------------------------------------------------------
Twitter.prototype.stream = function(method, params, callback)
{
	if (typeof(params) === 'function')
	{
		callback = params;
		params = null;
	}
	var url = buildUrl([this._streamUrl, '/user.json'].join(''), params);
	var request = this._oa.post(url, this.accessKey, this.accessSecret);
	var stream = new streamparser();
	stream.destroy = function()
	{
		if (typeof(request.abort) === 'function')
		{
			request.abort(); // node v0.4.0
		}
		else
		{
			request.socket.destroy();
		}
	};
	request.on('response', function(response)
	{
		response.on('data', function(chunk)
		{
			stream.receive(chunk);
		});
		response.on('error', function(error)
		{
			stream.emit('error', error);
		});
		response.on('end', function()
		{
			stream.emit('end', response);
		});
	});
	request.on('error', function(error)
	{
		stream.emit('error', error);
	});
	request.end();

	if (typeof(callback) === 'function')
	{
		callback(stream);
	}
	return this;
}

// -----------------------------------------------------------------------------
// Private methods for Twitter class
// -----------------------------------------------------------------------------
Twitter.prototype._doGet = function(path, params, callback)
{
	path = buildUrl(path, params);
	debug('GET ' + path);
	var url = [this._apiUrl, path].join('');
	this._oa.get(url,this.accessKey,this.accessSecret,this._createResponseHandler(callback));
};

Twitter.prototype._doPost = function(path, body, callback)
{
	debug('POST ' + path);
	debug('>> ' + util.inspect(body));
	var url = [this._apiUrl, path].join('');
	this._oa.post(url, this.accessKey, this.accessSecret, body, this._createResponseHandler(callback));
};

Twitter.prototype._createResponseHandler = function(callback)
{
	return function(error, data, response)
	{
		if( error )
		{
			return callback && callback(normalizeError(error), data, response);
		}
		else
		{
			var obj = undefined;
			if(data)
			{
				debug('<< ' + data);
				try
				{
					obj = JSON.parse(data);
				}
				catch(e)
				{
					obj = data;
					return callback(e, data, reponse);
				}
				return callback && callback(undefined, obj, response);
			}
			else
			{
				return callback && callback(undefined, data, response);
			}
		}
	};
};

module.exports = Twitter;
