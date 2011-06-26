//originally from here: https://github.com/cramforce/streamie/blob/master/lib/config.js
function init()
{
	var filename = __dirname+"/../../config.json";
	var text = require("fs").readFileSync(filename);
	if(!text)
	{
		throw new Error("Couldn't read config file "+filename);
	}
	var obj = JSON.parse(text);
	return obj;
}
exports.config = init();
