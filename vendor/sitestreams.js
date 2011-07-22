//originally based on https://github.com/yssk22/node-twbot/,
//reused from https://github.com/kazuyukitanimura/designo
//with help from https://github.com/jdub/node-twitter
var util = require('util'),
	url = require('url'),
	querystring = require('querystring'),
	config = require('./config').config,
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
	SITESTREAM_URL = 'http://sitestream.twitter.com/2b',
	AUTHORIZE_URL = 'https://twitter.com/oauth/authorize?oauth_token=';

/*
 * Twitter API Client
 *
 * @param consumerKey {String} consumerKey OAuth Consumer Key
 * @param consumerSecret {String} consumerSecret OAuth Consumer Secret
 * @param options {Object} API behavior options
 *
 */
function Twitter(consumerKey, consumerSecret, accessKey, accessSecret, options)
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
	this.accessKey = accessKey;
	this.accessSecret = accessSecret;
	this._apiUrl = options._apiUrl || API_URL;
	this._streamUrl = options._streamUrl || SITESTREAM_URL;
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

// -----------------------------------------------------------------------------
// Streaming Support
// -----------------------------------------------------------------------------
Twitter.prototype.stream = function(method, params, callback)
{
	if (typeof(params) == 'function')
	{
		callback = params;
		params = null;
	}
	if (params && params.follow && Array.isArray(params.follow))
	{
		params.follow = params.follow.join(',');
	}
	var url = buildUrl([this._streamUrl,'/'+method+'.json'].join(''), params);
	var request = this._oa.post(url, this.accessKey, this.accessSecret);
	var stream = new streamparser();
	stream.destroy = function()
	{
		if (typeof(request.abort) == 'function')
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
