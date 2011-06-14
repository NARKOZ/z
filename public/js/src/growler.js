// Copyright (c) 2008-2009 Kevin Sylvestre (http://ksylvest.com)
// Contributors:
//  Kevin Sylvestre (http://www.ksylvest.com)
//
// Growler is freely distributable under the terms of an MIT-style license.

const DEFAULT_INIT_OPTIONS = {
	location: 'bottom-right'
}

const DEFAULT_GROWL_OPTIONS = {
	growl_speed: 0.4,
	ungrowl_speed: 0.4,
	growl_direction: { y: 0, x: 0 },
	ungrowl_direction: { y: 10, x: 0 },
	duration: 5.0,
	opacity: 0.9,
	color: 'black',
	size: 'medium'
}

function combine(options, defaults)
{
	
	options = options || {};
	ret = Object.clone(defaults);
	Object.extend(ret, options);
	return ret;
}

function removeGrowl(growl, options)
{
	if (growl == undefined) return;
	options = combine(options, DEFAULT_GROWL_OPTIONS);
	new Effect.DropOut(growl, { duration: options.ungrowl_speed, after: function() { $(growl).remove(); } });	
}

function insertGrowl(growls, title, message, options)
{
	if (growls == undefined) return;
	options = combine(options, DEFAULT_GROWL_OPTIONS);
	var growl = new Element("div", { "class" : "growl" + ' ' + options.color + ' ' + options.size });	
	close = new Element("div", { "class" : "close" });
	close.update('&times;');
	close.observe('click', function() { removeGrowl(growl, options); });
	growl.insert(close);
	growl.insert(new Element("div", { "class" : "title" }).update(title));
	growl.insert(new Element("div", { "class" : "message" }).update(message));
	new Element.extend(growl);
	growls.insert(growl);
	if (options.duration)
	{
		removeGrowl.delay(options.duration, growl, options);
	}
	new S2.FX.Parallel(
	[
		$(growl).morph("opacity: "+options.opacity),
		new Effect.Move(growl, { x: options.growl_direction.x, y: options.growl_direction.y})
	],
	{
		duration: options.growl_speed
	});
}

var Growler = Class.create(
{	
	initialize: function(options)
	{
		options = combine(options, DEFAULT_INIT_OPTIONS);
		this.growls = new Element("div", { "id": "growls-container", "class" : "growls" + ' ' + options.location });
		this.growls.wrap(document.body);
	},
	growl: function(title, message, options)
	{
		return insertGrowl(this.growls, title, message, options);
	},	
	roar: function(title, message, color, options)
	{
		options = combine(options, { color: color } );
		return this.growl(title, message, options);
	},	
	warning: function(message, options)
	{
		return this.roar('Warning!', message, 'blue', options);
	},
	error: function(message, options)
	{
		return this.roar('Error!', message, 'red', options);
	},
	notice: function(message, options)
	{
		return this.roar('Notice!', message, 'green', options);
	}
});
