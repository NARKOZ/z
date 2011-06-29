//forked from https://github.com/smurthas/klout-js/blob/master/klout-js.js
var json = require('jsonreq');

var api_base = 'http://api.klout.com/1/';

module.exports = function(api_key)
{
	var client = {key: api_key};
	function fetch(endpoint, user, callback)
	{
		json.get(api_base + endpoint+".json?key="+client.key+"&users="+user, function(error, data)
		{
			if(error)
			{
				callback(error, data);
			}
			else
			{
				callback(null, data);
			}
		});
	}
	client.klout = function(usernames, callback)
	{
		fetch('klout', usernames, callback);
	};
	client.show = function(usernames, callback)
	{
		fetch('users/show', usernames, callback);
	};
	client.topics = function(usernames, callback)
	{
		fetch('users/topics', usernames, callback);
	};
	client.influencedBy = function(usernames, callback)
	{
		fetch('soi/influenced_by', usernames, callback);
	};
	client.influencerOf = function(usernames, callback)
	{
		fetch('soi/influenced_of', usernames, callback);
	};
	return client;
}
