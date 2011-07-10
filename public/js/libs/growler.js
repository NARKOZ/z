// Copyright (c) 2008-2009 Kevin Sylvestre (http://ksylvest.com)
// Contributors:
//  Kevin Sylvestre (http://www.ksylvest.com)
//
// Growler is freely distributable under the terms of an MIT-style license.
// Updated to work with "scripty2"

var DEFAULT_INIT_OPTIONS = {
	location: 'bottom-right'
}

var DEFAULT_GROWL_OPTIONS = {
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
	if (typeof(growl) == undefined)
	{
		return;
	}
	else
	{
		options = combine(options, DEFAULT_GROWL_OPTIONS);
		new Effect.Parallel(
		[
			new Effect.Opacity(growl, { to: 0.0 }),
			new Effect.Move(growl, { x: options.ungrowl_direction.x, y: options.ungrowl_direction.y, mode: 'relative' })
		],
		{
			duration: options.ungrowl_speed,
			afterFinish: function()
			{
				try
				{
					growl.remove();
				}
				catch(e)
				{}
			}
		});
		new Effect.DropOut(growl, {duration: options.ungrowl_speed});
	}
}

function insertGrowl(growls, image, title, message, options)
{
	if (typeof(growls) == undefined)
	{
		return;
	}
	options = combine(options, DEFAULT_GROWL_OPTIONS);
	var growl = new Element("div", {"class": "growl"+' '+options.color+' '+options.size});
	var table = new Element("table");
	var tr = new Element('tr');
	var td1 = new Element('td', {'style': 'width: 55px; margin-right: 15px;'});
	var td2 = new Element('td', {'style': 'width: 180px;'});
	td1.insert(new Element("img", {"src": image, "style": "height: 50px; width: 50px;", "alt": ""}));
	td2.insert({'top': new Element("div", {"class": "title"}).update(title)});
	td2.insert({'bottom': new Element("div", {"class": "message"}).update(message)});
	tr.insert({'top': td1});
	tr.insert({'bottom': td2});
	table.insert(tr);
	growl.insert(table);
	growl.observe('click', function()
	{
		removeGrowl(growl, options);
	});
	new Element.extend(growl);
	growls.insert(growl);
	if (options.duration)
	{
		removeGrowl.delay(options.duration, growl, options);
	}
	new Effect.Parallel(
	[
		new Effect.Opacity(growl, { to: options.opacity }),
		new Effect.Move(growl, { x: options.growl_direction.x, y: options.growl_direction.y, mode: 'relative' })
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
	growl: function(image, title, message, options)
	{
		return insertGrowl(this.growls, image, title, message, options);
	},
	roar: function(title, message, color, options)
	{
		options = combine(options, { color: color } );
		return this.growl(title, message, options);
	}
});
