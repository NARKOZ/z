// originally from http://widgets.twimg.com/j/1/widget.js
var K = function ()
{
	var a = navigator.userAgent;
	return{
		ie: a.match(/MSIE\s([^;]*)/)
	}
}();

var relative_time = function (a)
{
	var b = new Date();
	var c = new Date(a);
	if (K.ie)
	{
		c = Date.parse(a.replace(/( \+)/, ' UTC$1'))
	}
	var d = b - c;
	var e = 1000, minute = e * 60, hour = minute * 60, day = hour * 24, week = day * 7, month = day * 30, year = month * 12;
	if (isNaN(d) || d < 0)
	{
		return "just now"; //display just now rather than nothing i guess =\
	}
	if (d < e * 7)
	{
		return "just now";
	}
	if (d < minute)
	{
		return Math.floor(d / e) + " seconds ago";
	}
	if (d < minute * 2)
	{
		return "about a minute ago";
	}
	if (d < hour)
	{
		return Math.floor(d / minute) + " minutes ago";
	}
	if (d < hour * 2)
	{
		return "about an hour ago";
	}
	if (d < day)
	{
		return Math.floor(d / hour) + " hours ago";
	}
	if (d > day && d < day * 2)
	{
		return "yesterday";
	}
	if (d < week)
	{
		return Math.floor(d / day) + " days ago";
	}
	if (d > week && d < week * 2)
	{
		return "last week";
	}
	if (d > week && d < month)
	{
		return Math.floor(d / week) + " weeks ago";
	}
	if (d > month && d < month * 2)
	{
		return "last month";
	}
	if (d > month && d < year)
	{
		return Math.floor(d / month) + " months ago";
	}
	if (d > year && d < year * 2)
	{
		return "last year";
	}
	if (d > year)
	{
		return Math.floor(d / year) + " years ago";
	}
};
