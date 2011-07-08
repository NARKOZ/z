// originally from http://widgets.twimg.com/j/1/widget.js
function relative_time(a)
{
	var b = new Date();
	var c = new Date(a);
	if (BrowserDetect.browser == "MSIE")
	{
		c = Date.parse(a.replace(/( \+)/, ' UTC$1'))
	}
	var d = b - c;
	var e = 1000;
	var minute = e * 60;
	var hour = minute * 60;
	var day = hour * 24;
	var week = day * 7;
	var month = day * 30;
	var year = month * 12;
	if (isNaN(d))
	{
		return translation.just_now;
	}
	if (d < 0 || d < e * 3)
	{
		return translation.just_now;
	}
	if (d < minute)
	{
		return Math.floor(d / e) + " "+translation.seconds+" "+translation.ago;
	}
	if (d < minute * 2)
	{
		return +translation.minute+" "+translation.ago;
	}
	if (d < hour)
	{
		return Math.floor(d / minute) + " "+translation.minutes+" "+translation.ago;
	}
	if (d < hour * 2)
	{
		return translation.hour+" "+translation.ago;
	}
	if (d < day)
	{
		return Math.floor(d / hour) + " "+translation.hours+" "+translation.ago;
	}
	if (d > day && d < day * 2)
	{
		return translation.day;
	}
	if (d < week)
	{
		return Math.floor(d / day) + " "+translation.days+" "+translation.ago;
	}
	if (d > week && d < week * 2)
	{
		return translation.week;
	}
	if (d > week && d < month)
	{
		return Math.floor(d / week) + " "+translation.weeks+" "+translation.ago;
	}
	if (d > month && d < month * 2)
	{
		return translation.month;
	}
	if (d > month && d < year)
	{
		return Math.floor(d / month) + " "+translation.months+" "+translation.ago;
	}
	if (d > year && d < year * 2)
	{
		return translation.year;
	}
	if (d > year)
	{
		return Math.floor(d / year) + " "+translation.years+" "+translation.ago;
	}
};
