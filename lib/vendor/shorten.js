var json = require('jsonreq');
var querystring = require('querystring');

module.exports = function()
{
	var client = {};
	function fetch(url, callback)
	{
		json.get('http://is.gd/create.php?format=json&url='+url, function(error, data)
		{
			if(error)
			{
				callback(error, data);
			}
			else
			{
				callback(null, data.shorturl);
			}
		});
	}
	client.fetch = function(url, callback)
	{
		var escaped = querystring.escape(url)
		fetch(escaped, callback);
	};
	return client;
}
