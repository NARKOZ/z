var Effect = {};
Effect.Base = Class.create(S2.FX.Element, {
	initialize: function($super, element, options){
		$super(element, options);
		this.play();
	},
	morph: function(style){
		this.animate('style', this.element, {style: style, propertyTransitions: this.options.propertyTransitions || {}});
	}
});
Effect.Appear = Class.create(Effect.Base, {
	setup: function(){
		this.element.show().setOpacity(0.0);
		this.morph("opacity:1");
	}
});
Effect.Fade = Class.create(Effect.Base, {
	setup: function(){
		this.element.show();
		this.oldOpacity = this.element.style.opacity || '';
		this.morph("opacity:0");
	},
	teardown: function(){
		this.element.hide().setOpacity(this.oldOpacity);
	}
});
Effect.BlindUp = Class.create(Effect.Base, {
	setup: function(){
		this.element.makeClipping();
		this.originalHeight = this.element.style.height;
		this.morph("height: 0px");
	},
	teardown: function(){
		this.element.hide().undoClipping();
		this.element.style.height = this.originalHeight;
	}
});
Effect.BlindDown = Class.create(Effect.Base, {
	setup: function(){
		var height = this.element.getHeight();

		this.originalHeight = this.element.style.height;

		this.element.show().makeClipping();
		this.element.style.height = "0px";

		this.morph("height: " + height + "px");
	},
	teardown: function(){
		this.element.undoClipping();
		this.element.style.height = this.originalHeight;
	}
});
Effect.SlideUp = Class.create(Effect.Base, {
	setup: function(){
		this.element.makeClipping();

		var innerElement = this.element.down();
		this.originalMarginTop = innerElement.style.marginTop;
		this.animate('style', innerElement, { style: "margin-top: -" + innerElement.getHeight() + "px", propertyTransitions: this.options.propertyTransitions || { }});
	},
	teardown: function(){
		this.element.hide().undoClipping();
		this.element.down().style.marginTop = this.originalMarginTop;
	}
});
Effect.SlideDown = Class.create(Effect.Base, {
	setup: function(){
		this.element.show().makeClipping();

		var innerElement = this.element.down();
		this.originalMarginTop = innerElement.style.marginTop;

		innerElement.style.marginTop = "-" + innerElement.getHeight() + "px";

		this.animate('style', innerElement, { style: "margin-top: " + (this.originalMarginTop || 0) + "px", propertyTransitions: this.options.propertyTransitions || { }});
	},
	teardown: function(){
		this.element.undoClipping();
		this.element.down().style.marginTop = this.originalMarginTop;
	}
});
Effect.Highlight = Class.create(Effect.Base, {
	initialize: function($super, element, options){
		$super(element, Object.extend({
			startcolor: 			'#ffff99',
			endcolor:				false,
			restorecolor:			false,
			keepBackgroundImage:	false
		}, options));
	},
	setup: function(){
		if (this.element.getStyle('display')=='none') return this.cancel();

		if (!this.options.endcolor)		this.options.endcolor				= this.element.getStyle('background-color');
		if (!this.options.restorecolor)	this.options.restorecolor			= this.element.style.backgroundColor;
		if (this.options.keepBackgroundImage){
			this.restoreBackgroundImage = this.element.getStyle('background-image');
			this.element.style.backgroundImage = 'none';
		}

		this.element.style.backgroundColor = this.options.startcolor;

		this.morph("background-color: " + this.options.endcolor);
	},
	teardown: function(){
		this.element.style.backgroundColor = this.options.restorecolor;
		if (this.options.keepBackgroundImage){
			this.element.style.backgroundImage = this.restoreBackgroundImage;
		}
	}
});
Effect.DropOut = Class.create(Effect.Base, {
	setup: function(){
		this.oldStyle = {
			top:		this.element.getStyle('top'),
			left:		this.element.getStyle('left'),
			height:		this.element.getStyle('height'),
			opacity:	this.element.style.opacity || ''
		};
		this.element.makePositioned();
		this.morph("top: 100px; left: 0px; height: 0px; opacity: 0;");
	},
	teardown: function(){
		this.element.hide().undoPositioned().setStyle(this.oldStyle);
	}
});
Effect.Move = Class.create(Effect.Base, {
	initialize: function($super, element, options){
		$super(element, Object.extend({
			x: 		0,
			y:		0,
			mode:	'relative'
		}, options));
	},
	setup: function(){
		this.element.makePositioned();
		if (this.options.mode == 'absolute'){
			this.options.x = this.options.x - parseFloat(this.element.getStyle('left') || '0');
			this.options.y = this.options.y - parseFloat(this.element.getStyle('top')  || '0');
		}
		this.morph("left:" + this.options.x + "px; top:" + this.options.y + "px");
	}
});
Effect.Scale = Class.create(Effect.Base, {
	initialize: function($super, element, percent, options){
		$super(element, Object.extend({
			scaleX:				true,
			scaleY:				true,
			scaleContent:		true,
			scaleFromCenter:	false,
			scaleMode:			'box',	// 'box' or 'contents' or {} with provided values
			scaleFrom:			100.0,
			scaleTo:			percent || 0
		}, options || {}));
	},
	setup: function(){
		if (this.options.restoreAfterFinish){
			var style = this.element.style;
			this.originalStyle = {
				top:		style.top,
				left:		style.left,
				width:		style.width,
				height:		style.height,
				fontSize:	style.fontSize
			};
		}

		var dims;
		switch(this.options.scaleMode){
			case 'box':			dims = [this.element.offsetWidth, this.element.offsetHeight]; break;
			case 'contents':	dims = [this.element.scrollWidth, this.element.scrollHeight]; break;
			default:			dims = [this.options.scaleMode.originalWidth, this.options.scaleMode.originalHeight]; break;
		}

		if (this.options.scaleContent){
			var fontSize = this.element.getStyle('font-size') || '100%';
			['em','px','%','pt'].each( function(fontSizeType){
				if (fontSize.indexOf(fontSizeType) > 0){
					dims.fontSize     = parseFloat(fontSize);
					dims.fontSizeType = fontSizeType;
				}
			});
		}

		if (this.options.scaleFrom != 100){
			this.element.setStyle(this.getScaleStyle(this.options.scaleFrom, dims));
		}

		this.morph(this.getScaleStyle(this.options.scaleTo, dims));
	},
	teardown: function(){
		if (this.originalStyle) this.element.setStyle(this.originalStyle);
	},
	getScaleStyle: function(scale, dims){
		scale /= 100;

		var styles	= {},
			width	= dims[0] * scale,
			height	= dims[1] * scale;

		if (this.options.scaleX) styles.width  = width.round()  + "px";
		if (this.options.scaleY) styles.height = height.round() + "px";

		if (this.options.scaleFromCenter){
			var top  = - (height - dims[0])/2;
			var left = - (width  - dims[1])/2;

			if (this.element.getStyle('position') == 'absolute') {
				top  += this.element.offsetTop;
				left += this.element.offsetLeft;
			}

			if (this.options.scaleY) styles.top  = top  + "px";
			if (this.options.scaleX) styles.left = left + "px";
		}

		if ('fontSize' in dims){
			styles.fontSize = dims.fontSize * scale + dims.fontSizeType;
		}

		return styles;
	}
});
Effect.ScrollTo = Class.create(S2.FX.Base, {
	initialize: function($super, element, options){
		if(!(this.element = $(element))) throw(S2.FX.elementDoesNotExistError);

		$super(options);
		this.play();
	},
	setup: function(){
		var scroll = document.viewport.getScrollOffsets(),
			offset = this.element.cumulativeOffset();

		this.startLeft	= scroll.left;
		this.startTop	= scroll.top;
		this.left		= offset.left - this.startLeft;
		this.top		= offset.top - this.startTop;
	},
	update: function(position){
		position = this.options.transition(position);
		scrollTo(this.startLeft + this.left * position, this.startTop + this.top * position);
	}
});
Effect.Squish = Class.create(Effect.Scale, {
	initialize: function($super, element){
		$super(element, window.opera ? 1 : 0.4, { restoreAfterFinish: true });
	},
	setup: function($super){
		this.element.makeClipping();
		$super();
	},
	teardown: function($super){
		this.element.hide().undoClipping();
		$super();
	}
});
Effect.toggle = function(element, effect){
	element = $(element);

	effect = (effect || 'appear').toLowerCase();
	return new Effect[ arguments.callee.PAIRS[ effect ][ element.visible() ? 1 : 0 ] ](element, arguments[2] || {});
};

Effect.toggle.PAIRS = {
	slide:  ['SlideDown', 'SlideUp'],
	blind:  ['BlindDown', 'BlindUp'],
	appear: ['Appear', 'Fade']
};
Element.addMethods(
	$w('fade appear blindUp blindDown slideUp slideDown dropOut highlight move scrollTo squish').inject({}, function(methods, effect){
		methods[effect] = function(element, options){
			new Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
		};
		return methods;
	})
);
self.Effect = Effect;
