/* initial variables */
var audio = new Audio();
if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Safari")
{
	audio.src = "/audio/notify.mp3"; //use mp3 for ie and safari
}
else
{
	audio.src = "/audio/notify.ogg"; //and ogg for anyone else who supports the audio api
}
if (!store.get('client_blocks'))
{
	store.set('client_blocks', "");
}
store.set('connect_id', CONNECT_SID);
var content_queued = Array(); //holds our realtime tweets
var content_stored = Array();
var dms_cutoff = 50; //max amount of tweets to display before pruning occurs on all dms
var dms_loaded = 0; //quick method to hide each dm timelines loading image without needing to write a ton of code to do it
var dm_to = false; //catch dm reply
var following = Array(); //holds our following id's array
var geo_high_accuracy = false; //disable high accuracy on geo readings
var geo_timeout = 12000; //give to two minutes to figure out where you are
if (!store.get('hashtag_blocks'))
{
	store.set('hashtag_blocks', "");
}
var home_cutoff = 150; //max amount of tweets to display before pruning occurs on the home timeline
var latit = false; //hold our latitude
var loaded = false; //not loaded
var longit = false; //hold our longitude
var max_file_size = 2; //in megabytes
if (!S2.Extensions.HardwareAcceleratedCSSTransitions)
{
	var max_fps = 30; //limit all effects to no more than this amount of fps so we dont have hanging / major chopping
}
else
{
	var max_fps = 120; //otherwise open the throttle all the way for effects
}
var mentions_cutoff = 100; //max amount of tweets to display before pruning occurs on the mentions timeline
var paused = false; //allow the engine itself to be momentarily 'paused'..not sure how im going to work this out properly
var pttid = 0; //this serves as the (#) amount displayed when paused
var prune_tweets_interval = 60000; //start the pruning loop over again every minute
var reply_id = false; //catch reply
var screen_name = ""; //our own screen name
var socket = io.connectWithSession();
var stream_queue_interval = 1500; //once a second
var update_relative_dms_interval = 60000; //once a minute
var update_relative_home_interval = 15000; //every 15 seconds
var update_relative_mentions_interval = 30000; //every 30 seconds
var user_id = 0; //our own user id
if (!store.get('user_blocks'))
{
	store.set('user_blocks', "");
}
if (!store.get('users'))
{
	store.set('users', "");
}
/*var window_height =  document.viewport.getDimensions().height-Number(30);
var window_width =  document.viewport.getDimensions().width-Number(30);*/

/* set up some of our effects */
new S2.FX.Base(
{
	fps: max_fps
});

z_engine_attrition(); //call the below function

/* the websocket itself */
function z_engine_attrition()
{
	if (navigator.geolocation)
	{
		navigator.geolocation.getCurrentPosition(z_engine_get_geolocation, z_engine_geolocation_error,
		{
			enableHighAccuracy: geo_high_accuracy,
			maximumAge: 0,
			timeout: geo_timeout
		});
	}
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1)
	{
		window.webkitNotifications.requestPermission();
	}
	if (!loaded)
	{
		if (window.File && window.FileReader && window.FileList && window.Blob)
		{
			var image = $("image");
			image.show();
			/*var bg_image = $("container");
			bg_image.ondragover = function(event)
			{
				event.preventDefault();
				return false;
			}
			bg_image.ondragend = function(event)
			{
				event.preventDefault();
				return false;
			}
			bg_image.ondrop = function(event)
			{
				event.preventDefault();
				var dropped = event.dataTransfer.files[0];
				var reader = new FileReader();
				reader.onload = function(img)
				{
					$(document.body).setStyle("background-url('"+img.target.result+"'); repeat left top;");
				};
				reader.readAsDataURL(dropped);
				return false;
			}*/
			image.ondragover = function(event)
			{
				event.preventDefault();
				image.setStyle("border-color: #aaa;");
				return false;
			}
			image.ondragend = function(event)
			{
				event.preventDefault();
				image.setStyle("border-color: #ddd;");
				return false;
			}
			image.ondrop = function (event)
			{
				event.preventDefault();
				var dropped = event.dataTransfer.files[0];
				z_engine_dropped_image(dropped);
				return false;
			}
			image.addTip("drag and drop images here!",
			{
				className: 'user',
				showOn: 'click',
				target: true
			});
		}
		//$("container").setStyle("width: "+window_width+"px; height: "+window_height+"px;");
		$("loading-home").center(8);
		$("loading-mentions").center(8);
		$("loading-inbox").center(8);
		$("loading-outbox").center(8);
		new Event.observe("logout","click",function(event)
		{
			Event.stop(event);
			return z_engine_logout();
		});
		new Event.observe("pause","click",function(event)
		{
			Event.stop(event);
			return z_engine_tweet_pause();
		});
		new Event.observe("shorten","click",function(event)
		{
			Event.stop(event);
			return z_engine_shorten_urls();
		});
		new Event.observe("new-tweet","keyup",function(event)
		{
			if($("new-tweet").getValue().length === 0)
			{
				dm_to = false;
				reply_id = false;
			}
			else if($("new-tweet").getValue().length <= 140)
			{
				$("new-tweet").setStyle("color: #4d4d4d;");
			}
			else if($("new-tweet").getValue().length >= 141)
			{
				$("new-tweet").setStyle("color: red;");
			}
		});
		new Event.observe("new-tweet","keydown",function(event)
		{
			if($("new-tweet").getValue().length === 0)
			{
				reply_id = false;
			}
			else if($("new-tweet").getValue().length <= 140)
			{
				$("new-tweet").setStyle("color: #4d4d4d;");
			}
			else if($("new-tweet").getValue().length >= 141)
			{
				$("new-tweet").setStyle("color: red;");
			}
		});
	}
	socket.on("connect",function()
	{
		if (!loaded)
		{
			$("new-tweet").setValue("connected...");
		}
	});
	socket.on("message", function(json)
	{
		var string = JSON.stringify(json);
		console.log(string);
		if (string.isJSON() && string.evalJSON(true)) //quick sanity check before we begin
		{
			string = ""; //dont need it anymore
			if (json.loaded && !loaded)
			{
				loaded = true;
				$("new-tweet").setValue("");
				$("new-tweet").enable();
				new Event.observe("new-tweet-form", "submit", function(event)
				{
					Event.stop(event);
					z_engine_send_tweet();
				});
				z_engine_clicker("home-timeline-click", "home-timeline"); //home
				z_engine_clicker("mentions-timeline-click", "mentions-timeline"); //mentions
				z_engine_clicker("dms-timeline-click", "dms-timeline"); //dms
				z_engine_clicker_dms("dms-inbox-timeline-click", "dms-inbox-timeline");
				z_engine_clicker_dms("dms-outbox-timeline-click", "dms-outbox-timeline");
				socket.emit("message", {fetch: "home"});
				/*var populate_mentions_tab = setTimeout(function()
				{
					socket.emit("message", {fetch: "mentions"});
				},10000);
				var populate_dms_inbox_tab = setTimeout(function()
				{
					socket.emit("message", {fetch: "dms-inbox"});
				},20000);
				var populate_dms_outbox_tab = setTimeout(function()
				{
					socket.emit("message", {fetch: "dms-outbox"});
				},30000);*/
				var update_relative_home = setInterval(function()
				{
					z_engine_update_relative_time("time.home");
				},update_relative_home_interval);
				var update_relative_mentions = setInterval(function()
				{
					z_engine_update_relative_time("time.mentions");
				},update_relative_mentions_interval);
				var update_relative_dms = setInterval(function()
				{
					z_engine_update_relative_time("time.dms");
				},update_relative_dms_interval);
				var update_relative_threaded = setInterval(function()
				{
					if ($$("time.threaded").length > 0)
					{
						z_engine_update_relative_time("time.threaded");
					}
				},update_relative_home_interval);
				var prune_old_tweets = setInterval(function()
				{
					if (!paused)
					{
						z_engine_prune_tweets();
					}
				},prune_tweets_interval);
				var run_stream_queue = setInterval(function()
				{
					if (!paused)
					{
						z_engine_stream_queue();
					}
				},stream_queue_interval);
			}
			else if (json.loaded && loaded)
			{
				$("new-tweet").enable();
			}
			else if (json["delete"]) //catch it like this, it can cause errors in other browsers like opera
			{
				if (typeof(json["delete"].status) == 'object')
				{
					var id = json["delete"].status.id_str;
				}
				else
				{
					var id = 0; //we will only handle normal tweets from here, dms are handled elsewhere
				}
				z_engine_drop_tweet(id);
			}
			else if (json.direct_message)
			{
				z_engine_tweet(json.direct_message, "dms");
				if (json.direct_message.sender.screen_name != screen_name)
				{
					z_engine_notification(json.direct_message.sender.profile_image_url, "@"+json.direct_message.sender.screen_name+" sent a direct message", json.direct_message.text);
				}
			}
			else if (json.dms) //realtime dms DO NOT come through here, this is the initial 50 that we throw in there
			{
				dms_loaded++;
				json.dms.each(function(item)
				{
					z_engine_tweet(item, "dms");

				});
				switch (dms_loaded)
				{
					case 1:
						$("loading-inbox").fade();
						$("loading-outbox").appear();
					break;
					case 2:
						$("loading-outbox").fade();
					break;
				}
			}
			else if (json.event)
			{
				var event = json.event;
				switch (event)
				{
					case 'block':
						var current_blocks = $w(store.get('user_blocks')).uniq();
						var exists = false;
						current_blocks.each(function(item)
						{
							if (item == json.target.screen_name)
							{
								exists = true;
								$break;
							}
						});
						if (!exists)
						{
							var new_block = json.target.screen_name;
							var blocks = current_blocks.join(" ")+" "+new_block;
							store.set('user_blocks', blocks);
						}
					break;
					case 'unblock':
						var current_blocks = $w(store.get('user_blocks')).uniq();
						var new_blocks = "";
						current_blocks.each(function(item)
						{
							if (item != json.target.screen_name)
							{
								new_blocks += item+" ";
							}
						});
						store.set('user_blocks', new_blocks);
					break;
					case 'favorite':
						if (json.source.screen_name != screen_name)
						{
							z_engine_notification(json.source.profile_image_url, "@"+json.source.screen_name+" faved your tweet!", json.target_object.text);
						}
					break;
					case 'unfavorite':
					break;
					case 'follow':
						if (json.source.screen_name != screen_name)
						{
							z_engine_notification(json.source.profile_image_url, "@"+json.source.screen_name+" is following you!", json.source.description);
						}
					break;
					case 'list_member_added':
						if (json.source.screen_name != screen_name)
						{
							z_engine_notification(json.source.profile_image_url, "@"+json.source.screen_name+" put you in "+json.target_object.full_name+"!", json.target_object.description);
						}
					break;
					case 'list_created':
					break;
					case 'list_destroyed':
					break;
					case 'list_member_removed':
					break;
					case 'list_updated':
					break;
					case 'list_user_subscribed':
						if (json.source.screen_name != screen_name)
						{
							z_engine_notification(json.source.profile_image_url, "@"+json.source.screen_name+" subscribed to "+json.target_object.full_name+"!", json.target_object.description);
						}
					break;
					case 'list_user_unsubscribed':
					break;
					case 'scrub_geo':
					break;
					case 'user_update':
					break;
					default:
						console.log(JSON.stringify(json.event)); //spit out the event name for quick reference...
						console.log(JSON.stringify(json)); //..then spit out the data itself so we can study it
					break;
				}
			}
			else if (json.friends)
			{
				var friends = json.friends.join(" ");
				store.set('friends', friends);
			}
			else if (json.home) //realtime tweets DO NOT come through here, this is the initial 50 that we throw in there
			{
				json.home.each(function(item)
				{
					z_engine_tweet(item, "home");
				});
				$("loading-home").fade();
				$("loading-mentions").appear();
				//socket.emit("message", {fetch: "userstream"});
			}
			else if (json.info)
			{
				screen_name = json.info.screen_name;
				user_id = json.info.user_id;
				store.set('screen_name', screen_name);
				store.set('user_id', user_id);
			}
			else if (json.klout)
			{
				var data = json.klout;
				var id = json.id_str;
				if (data != "error" || data.status != 200)
				{
					z_engine_set_klout(data.users, id);
				}
				else
				{
					if ($("klout-"+id))
					{
						$("klout-"+id).setStyle('cursor: default;');
						$("klout-"+id).setAttribute('onclick', '');
						$("klout-"+id).addTip('<big><strong>?</strong></big>',
						{
							className: 'klout',
							stem: true,
							target: true,
							targetJoint: ['left', 'top'],
							tipJoint: ['right', 'bottom']
						});
					}
				}
			}
			else if (json.mentions) //realtime mentions DO NOT come through here, this is the initial 50 that we throw in there
			{
				json.mentions.each(function(item)
				{
					z_engine_tweet(item, "mentions");
				});
				$("loading-mentions").fade();
				$("loading-inbox").appear();
			}
			else if (json.retweet_info)  //catch what we just retweeted, change the clicking event and icon
			{
				var data = json.retweet_info;
				if ($("comment-"+data.retweeted_status.id_str))
				{
					if ($("rt-"+data.retweeted_status.id_str))
					{
						$("rt-"+data.retweeted_status.id_str).writeAttribute("src","img/rtd.png");
						$("rt-"+data.retweeted_status.id_str).writeAttribute("onclick","z_engine_destroy('"+data.id_str+"','rt');");
					}
					if ($("rt-"+data.retweeted_status.id_str+"-mentioned"))
					{
						$("rt-"+data.retweeted_status.id_str+"-mentioned").writeAttribute("src","img/rtd.png");
						$("rt-"+data.retweeted_status.id_str+"-mentioned").writeAttribute("onclick","z_engine_destroy('"+data.id_str+"','rt');");
					}
					if ($("rt-"+data.retweeted_status.id_str+"-threaded"))
					{
						$("rt-"+data.retweeted_status.id_str+"-threaded").writeAttribute("src","img/rtd.png");
						$("rt-"+data.retweeted_status.id_str+"-threaded").writeAttribute("onclick","z_engine_destroy('"+data.id_str+"','rt');");
					}
				}
			}
			else if (json.server_event)
			{
				console.log(JSON.stringify(json));
				switch (json.server_event)
				{
					case 'end':
						$("new-tweet").disable();
						z_engine_notification("", "notice!", "lost connection to the userstream, reconnecting...");
					break;
					case 'error':
						$("new-tweet").disable();
						z_engine_notification("", "notice!", "userstream error occurred, reconnecting...");
					break;
				}
			}
			else if (json.shorten)
			{
				var current_tweet = $("new-tweet").getValue().replace(json.original, json.shorten);
				$("new-tweet").setValue(current_tweet);
			}
			else if (json.show)
			{
				z_engine_tweet(json.show, "threaded");
			}
			else if (json.text && json.user && json.created_at) //ensure we are about to do this to a valid tweet
			{
				content_queued.push(JSON.stringify(json));
				if (paused)
				{
					$("paused-count").update("("+pttid+")");
					pttid++;
				}
				if (json.retweeted_status && json.retweeted_status.user.screen_name == screen_name && json.user.screen_name != screen_name)
				{
					z_engine_notification(json.user.profile_image_url, "@"+json.user.screen_name+" retweeted you!", json.retweeted_status.text);
				}
			}
		}
		else
		{
			if (!string.isJSON())
			{
				console.log("not json, skipping");
			}
			else if (!string.evalJSON(true))
			{
				console.log("json could not be properly evaluated, skipping");
			}
			else
			{
				console.log("unknown error, output: "+string);
			}
		}
	});
	socket.on('disconnect', function()
	{
		$("new-tweet").disable();
		setTimeout(function()
		{
			window.location = "/";
		},5000);
	});
}

/* the "home", "mentions", "messages", etc switcher */
function z_engine_clicker(id, this_id)
{
	new Event.observe(id, "click", function(event)
	{
		Event.stop(event);
		if (this_id == "dms-timeline")
		{
			new S2.FX.Parallel(
			[
				new Effect.Fade("dms-timeline-click",
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.Appear("dms-inbox-timeline-click",
				{
					delay: 0.1,
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.Appear("dms-outbox-timeline-click",
				{
					delay: 0.1,
					duration: 0.25,
					mode: 'relative'
				})
			],
			{
				duration: 1
			});
		}
		else
		{
			if ($("dms-inbox-timeline-click").visible() || $("dms-outbox-timeline-click").visible())
			{
				new S2.FX.Parallel(
				[
					new Effect.Fade("dms-outbox-timeline-click",
					{
						duration: 0.15,
						mode: 'relative'
					}),
					new Effect.Fade("dms-inbox-timeline-click",
					{
						duration: 0.15,
						mode: 'relative'
					}),
					new Effect.Appear("dms-timeline-click",
					{
						delay: 0.15,
						duration: 0.25,
						mode: 'relative'
					})
				],
				{
					duration: 1
				});
			}
		}
		if (!$(this_id).visible())
		{
			if ($("home-timeline").visible())
			{
				var hide = "home-timeline";
			}
			if ($("mentions-timeline").visible())
			{
				var hide = "mentions-timeline";
			}
			if ($("threaded-timeline").visible())
			{
				var hide = "threaded-timeline";
			}
			if ($("dms-timeline").visible())
			{
				var hide = "dms-timeline";
			}
			new S2.FX.Parallel(
			[
				new Effect.Fade(hide,
				{
					duration: 0.4,
					mode: 'relative'
				}),
				new Effect.Appear(this_id,
				{
					delay: 0.35,
					duration: 0.4,
					mode: 'relative'
				})
			],
			{
				duration: 1,
				after: function()
				{
					$("threaded-timeline").update();
				}
			});
		}
	});
}

/* a more specific clicker for the inbox / outbox page */
function z_engine_clicker_dms(id, this_id)
{
	new Event.observe(id, "click", function(event)
	{
		Event.stop(event);
		if (!$(this_id).visible())
		{
			if ($("dms-outbox-timeline").visible())
			{
				var hide = "dms-outbox-timeline";
			}
			else if ($("dms-inbox-timeline").visible())
			{
				var hide = "dms-inbox-timeline";
			}
			new S2.FX.Parallel(
			[
				new Effect.Fade(hide,
				{
					duration: 0.4,
					mode: 'relative'
				}),
				new Effect.Appear(this_id,
				{
					delay: 0.35,
					duration: 0.4,
					mode: 'relative'
				})
			],
			{
				duration: 1
			});
		}
	});
}

/* delete a tweet / dm */
function z_engine_destroy(id, method)
{
	var confirm_delete = confirm("\nare you sure you want to delete this?\n");
	if (confirm_delete)
	{
		if (method == "tweet" || method == "rt")
		{
			var params = {destroy: {status: {id_str: id}}};
		}
		else if (method == "dm")
		{
			var params = {destroy_dm: {status: {id_str: id}}};
			z_engine_drop_tweet(id);
		}
		if (method == "rt")
		{
			if ($("rt-"+id))
			{
				$("rt-"+id).setAttribute("src","img/rt.png");
				$("rt-"+id).setAttribute("onclick","z_engine_retweet('"+id+"');");
			}
			if ($("rt-"+id+"-mentioned"))
			{
				$("rt-"+id+"-mentioned").setAttribute("src","img/rt.png");
				$("rt-"+id+"-mentioned").setAttribute("onclick","z_engine_retweet('"+id+"');");
			}
			if ($("rt-"+id+"-threaded"))
			{
				$("rt-"+id+"-threaded").setAttribute("src","img/rt.png");
				$("rt-"+id+"-threaded").setAttribute("onclick","z_engine_retweet('"+id+"');");
			}
		}
		socket.emit("message", params);
	}
}

function z_engine_drop_tweet(id)
{
	if ($("comment-"+id))
	{
		$("comment-"+id).setStyle("text-decoration: line-through;");
		if ($("del-"+id))
		{
			$("del-"+id).fade();
		}
		if ($("fave-"+id))
		{
			$("fave-"+id).fade();
		}
		if ($("reply-"+id))
		{
			$("reply-"+id).fade();
		}
		if ($("rt-"+id))
		{
			$("rt-"+id).fade();
		}
		setTimeout(function()
		{
			new S2.FX.Parallel(
			[
				new Effect.Fade('comment-'+id,
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindUp('comment-'+id,
				{
					duration: 1,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		},3000);
	}
	if ($("comment-"+id+"-mentioned"))
	{
		if ($("del-"+id+"-mentioned"))
		{
			$("del-"+id+"-mentioned").fade();
		}
		if ($("fave-"+id+"-mentioned"))
		{
			$("fave-"+id+"-mentioned").fade();
		}
		if ($("reply-"+id+"-mentioned"))
		{
			$("reply-"+id+"-mentioned").fade();
		}
		if ($("rt-"+id+"-mentioned"))
		{
			$("rt-"+id+"-mentioned").fade();
		}
		setTimeout(function()
		{
			new S2.FX.Parallel(
			[
				new Effect.Fade('comment-'+id+'-mentioned',
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindUp('comment-'+id+'-mentioned',
				{
					duration: 1,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		},3000);
	}
	if ($("comment-"+id+"-threaded"))
	{
		if ($("del-"+id+"-threaded"))
		{
			$("del-"+id+"-threaded").fade();
		}
		if ($("fave-"+id+"-threaded"))
		{
			$("fave-"+id+"-threaded").fade();
		}
		if ($("reply-"+id+"-threaded"))
		{
			$("reply-"+id+"-threaded").fade();
		}
		if ($("rt-"+id+"-threaded"))
		{
			$("rt-"+id+"-threaded").fade();
		}
		setTimeout(function()
		{
			new S2.FX.Parallel(
			[
				new Effect.Fade('comment-'+id+'-threaded',
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindUp('comment-'+id+'-threaded',
				{
					duration: 1,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		},3000);
	}
}

/* handle image uploads */
function z_engine_dropped_image(image)
{
	if (image.size <= max_file_size * 1024 * 1024)
	{
		switch(image.type)
		{
			case 'application/pdf':
			case 'image/apng':
			case 'image/bmp':
			case 'image/gif':
			case 'image/jpeg':
			case 'image/jpg':
			case 'image/png':
			case 'image/tiff':
				var form = new FormData();
				form.append("image", image);
				form.append("key", imgur_key);
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function()
				{
					if(this.readyState == 3)
					{
						$("image").setStyle("border-color: yellow;");
					}
					if(this.readyState == 4 && this.status == 200)
					{
						var response = this.responseText.evalJSON(true);
						var image_url = response.upload.links.original;
						var current_tweet = $("new-tweet").getValue();
						if (current_tweet.length > 0)
						{
							var new_tweet = current_tweet+" "+image_url;
						}
						else if (current_tweet.length == 0)
						{
							var new_tweet = image_url;
						}
						$("new-tweet").setValue(new_tweet);
						$("image").setStyle("border-color: green;");
						setTimeout(function()
						{
							$("image").setStyle("border-color: #ddd;");
						},1500);
					}
					if(this.readyState == 4 && this.status != 200)
					{
						$("image").setStyle("border-color: red;");
						setTimeout(function()
						{
							$("image").setStyle("border-color: #ddd;");
						},1500);
					}
				}
				xhr.open("POST", "http://api.imgur.com/2/upload.json", true);
				xhr.send(form);
			break;
		}
	}
}

/* favorite a tweet */
function z_engine_favorite(id)
{
	socket.emit("message", {favorite: {status: {id_str: id}}});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("src","img/favd.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("src","img/favd.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("src","img/favd.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
}

/* get geolocation, set vars */
function z_engine_get_geolocation(position)
{
	latit = position.coords.latitude;
	longit = position.coords.longitude;
}

/* if we have some bizarre error, handle it down here (currently just keeps everything set to false) */
function z_engine_geolocation_error(err)
{
	switch (err.code)
	{
		case 0: //unknown error
		case 1: //denied
		case 2: //unavailable
		case 3: //timeout
			latit = false;
			longit = false;
		break;
	}
}

/* get a users klout score */
function z_engine_get_klout(author, id)
{
	socket.emit("message", {klout: author, id_str: id});
}

/* properly log out a user */
function z_engine_logout()
{
	socket.disconnect();
	$("new-tweet").disable();
	$("new-tweet").setValue("see ya!");
	store.remove('account');
	store.remove('friends');
	store.remove('screen_name');
	store.remove('user_id');
	window.location = "/oauth/logout";
}

/* send a notification to the client */
function z_engine_notification(av, head, text)
{
	if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser != "MSIE")
	{
		audio.play();
	}
	if (text == null)
	{
		text = "";
	}
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) //we can access webkit notifications
	{
		var notification = window.webkitNotifications.createNotification(av, head, text);
		notification.show();
		setTimeout(function()
		{
			notification.cancel();
		},5000);
	}
	else if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1) //we might be able to access them if the user allows us to
	{
		window.webkitNotifications.requestPermission();
		growler.growl(z_engine_parse_tweet(head), z_engine_parse_tweet(text)); //send a growler notification anyway
	}
	else if (!window.webkitNotifications || window.webkitNotifications && window.webkitNotifications.checkPermission() == 2) //we cant access notifications
	{
		//todo: support avatars in here as well
		growler.growl(z_engine_parse_tweet(head), z_engine_parse_tweet(text));
	}
}

/* parse and convert all mentions, links, and hashtags appropriately into their respective links */
function z_engine_parse_tweet(text)
{
	if(!text)
	{
		return text;
	}
	else
	{
		text = twttr.txt.autoLink(text); //autolink everything
		text = text.replace(/\n\r?/g, '<br />'); //convert linebreaks into html linebreaks
		return text;
	}
}

/* prune through older tweets, delay each timelines pruning by 10 seconds so we have a constantly looping without huge overhead */
function z_engine_prune_tweets()
{
	var tweet_elements = $("home-timeline").childElements();
	tweet_elements.each(function(item, index)
	{
		if (index > home_cutoff)
		{
			$(item).remove();
		}
	});
	setTimeout(function()
	{
		var mention_elements = $("mentions-timeline").childElements();
		mention_elements.each(function(item, index)
		{
			if (index > mentions_cutoff)
			{
				$(item).remove();
			}
		});
	},10000);
	setTimeout(function()
	{
		var dm_elements = $("dms-inbox-timeline").childElements();
		dm_elements.each(function(item, index)
		{
			if (index > dms_cutoff)
			{
				$(item).remove();
			}
		});
	},20000);
	setTimeout(function()
	{
		var dm_sent_elements = $("dms-outbox-timeline").childElements();
		dm_sent_elements.each(function(item, index)
		{
			if (index > dms_cutoff)
			{
				$(item).remove();
			}
		});
	},30000);
	setTimeout(function()
	{
		if ($$("#threaded-timeline").length > 0)
		{
			var threaded_elements = $("threaded-timeline").childElements();
			threaded_elements.each(function(item, index)
			{
				if (index > home_cutoff)
				{
					$(item).remove();
				}
			});
		}
	},40000);
}

/* reply to a specific tweet */
function z_engine_reply(author, id, mentions)
{
	reply_id = id;
	$("new-tweet").setValue("@"+author+" "+mentions);
	$("new-tweet").focus();
}

/* reply to a dm */
function z_engine_reply_dm(id, user)
{
	dm_to = id;
	$("new-tweet").setValue("~");
	$("new-tweet").focus();
}

/* retweet a tweet */
function z_engine_retweet(id, author, text)
{
	var confirm_rt1 = confirm("\nare you sure you want to retweet this?\n");
	if (confirm_rt1)
	{
		var confirm_rt2 = confirm("ok for normal retweet\ncancel for commented retweet");
		if (confirm_rt2)
		{
			socket.emit("message", {retweet: {status: {id_str: id}}});
		}
		else
		{
			reply_id = id; //set this as a reply
			$("new-tweet").setValue("RT @"+author+" "+text);
			$("new-tweet").focus();
		}
	}
}

/* send our tweet */
function z_engine_send_tweet()
{
	if ($("new-tweet").getValue().length > 0 && $("new-tweet").getValue().length <= 140)
	{
		$("new-tweet").disable();
		var temp_element = $("new-tweet").getValue().strip();
		var send = new Hash();
		if (!dm_to) //handle regular tweet
		{
			var send = {
				status: {
					status: temp_element,
					include_entities: true
				}
			}
			if (latit && longit)
			{
				var geo = {
					display_coordinates: true,
					lat: latit,
					'long': longit
				}
				new Object.extend(send.status, geo);
			}
			if (reply_id)
			{
				var in_reply_to_status = {
					in_reply_to_status_id: reply_id
				}
				new Object.extend(send.status, in_reply_to_status);
			}
		}
		else //handle direct message
		{
			if (temp_element.startsWith("~"))
			{
				temp_element.replace(/~/i,"");
			}
			var send = {
				direct_message: {
					text: temp_element,
					user_id: dm_to
				}
			}
		}
		socket.emit("message", send);
		reply_id = false;
		dm_to = false;
		$("new-tweet").setValue("");
		$("new-tweet").enable();
	}
}

/* set the klout icon up properly */
function z_engine_set_klout(data, id)
{
	if (typeof(data) === "object")
	{
		if (data.length > 0 && typeof(id) == "string")
		{
			var amp = Math.round(data[0].score.amplification_score);
			var one_day = Math.round(data[0].score.delta_1day);
			var description = data[0].score.description;
			var five_days = Math.round(data[0].score.delta_5day);
			var kclass = data[0].score.kclass;
			var kclass_description = data[0].score.kclass_description;
			var kscore = Math.round(data[0].score.kscore);
			var kscore_description = data[0].score.kscore_description;
			var net = Math.round(data[0].score.network_score);
			var reach = Math.round(data[0].score.true_reach);
			var slope = Math.round(data[0].score.slope);
			var klout_info = 'score: <strong>'+kscore+'</strong><br />';
			klout_info += 'amp: <strong>'+amp+'</strong><br />';
			klout_info += 'network: <strong>'+net+'</strong><br />';
			klout_info += 'reach: <strong>'+reach+'</strong><br />';
			if ($("klout-"+id))
			{
				$("klout-"+id).addTip(klout_info,
				{
					className: 'klout',
					stem: true,
					target: true,
					targetJoint: ['left', 'top'],
					tipJoint: ['right', 'bottom']
				});
				$("klout-"+id).setAttribute('src', 'img/kltd.png');
				$("klout-"+id).setAttribute('title', '');
			}
		}
	}
}

/* shorten urls to goo.gl */
function z_engine_shorten_urls()
{
	var current_tweet = $("new-tweet").getValue();
	if (current_tweet.length > 0)
	{
		current_tweet.replace(/((https?\:\/\/)|(www\.))([^ ]+)/g,function(url)
		{
			socket.emit("message", {shorten: url});
		});
	}
}

/* output at max one tweet per second */
function z_engine_stream_queue()
{
	if (content_queued.length > 0)
	{
		var queue = content_queued.shift();
		if (typeof(queue) === "undefined")
		{
			//do nothing
		}
		else
		{
			if (queue.isJSON())
			{
				var data = queue.evalJSON(true);
				z_engine_tweet(data, "home");
			}
		}
	}
}

function z_engine_threaded(init, id)
{
	if (init)
	{
		if ($("home-timeline").visible())
		{
			var hide = "home-timeline";
		}
		if ($("mentions-timeline").visible())
		{
			var hide = "mentions-timeline";
		}
		new S2.FX.Parallel(
		[
			new Effect.Fade(hide,
			{
				duration: 0.4,
				mode: 'relative'
			}),
			new Effect.Appear("threaded-timeline",
			{
				delay: 0.35,
				duration: 0.4,
				mode: 'relative'
			})
		],
		{
			duration: 1
		});
		if (!content_stored[init])
		{
			socket.emit("message", {show: {id_str: init}});
		}
		else
		{
			var data = content_stored[init].evalJSON(true);
			z_engine_tweet(data, "threaded");
		}
	}
	else
	{
		if (!content_stored[id])
		{
			socket.emit("message", {show: {id_str: id}}); //continue the loop until nothing is left
		}
		else
		{
			var data = content_stored[id].evalJSON(true);
			z_engine_tweet(data, "threaded");
		}
	}
}

/* the engine that handles, sorts, and displays our data */
function z_engine_tweet(data, output)
{
	if (output != "dms")
	{
		if (!data.retweeted_status)
		{
			var author = data.user.screen_name;
			var author2 = false;
			var avatar = data.user.profile_image_url;
			var avatar2 = false;
			var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,'');
			var description = data.user.description;
			var entities = data.entities;
			var faved = data.favorited;
			var followers = data.user.followers_count;
			var following = data.user.friends_count;
			var id = data.id_str;
			var location = data.user.location;
			var locked = data.user["protected"]; //prevent an issue in ie
			var name = data.user.name;
			var place = data.place;
			var reply = data.in_reply_to_screen_name;
			var replyid = data.in_reply_to_status_id_str;
			var rtd = false;
			var source = data.source.stripTags();
			var text = data.text;
			var tweets = data.user.statuses_count;
			var userid = data.user.id;
			var verified = data.user.verified;
		}
		else
		{
			var author = data.retweeted_status.user.screen_name;
			var author2 = data.user.screen_name;
			var avatar = data.retweeted_status.user.profile_image_url;
			var avatar2 = data.user.profile_image_url;
			var date = new Date(data.retweeted_status.created_at).toLocaleString().replace(/GMT.+/,'');
			var description = data.retweeted_status.user.description;
			var entities = data.retweeted_status.entities;
			var faved = data.retweeted_status.favorited;
			var followers = data.retweeted_status.user.followers_count;
			var following = data.retweeted_status.user.friends_count;
			var id = data.retweeted_status.id_str;
			var location = data.retweeted_status.user.location;
			var locked = data.retweeted_status.user["protected"]; //prevent an issue in ie
			var name = data.retweeted_status.user.name;
			var place = data.retweeted_status.place;
			var reply = data.retweeted_status.in_reply_to_screen_name;
			var replyid = data.retweeted_status.in_reply_to_status_id_str;
			var rtd = true;
			var source = data.retweeted_status.source.stripTags();
			var text = data.retweeted_status.text;
			var tweets = data.retweeted_status.user.statuses_count;
			var userid = data.retweeted_status.user.id;
			var userid2 = data.user.id;
			var verified = data.retweeted_status.user.verified;
		}
	}
	else
	{
		var author = data.sender.screen_name;
		var avatar = data.sender.profile_image_url;
		var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,'');
		var description = data.sender.description;
		var entities = false;
		var followers = data.sender.followers_count;
		var following = data.sender.friends_count;
		var id = data.id_str;
		var name = data.sender.name;
		var location = data.sender.location;
		var locked = false;
		var reply = data.recipient.screen_name;
		var rtd = false;
		var text = data.text;
		var tweets = data.sender.statuses_count;
		var userid = data.sender_id;
		var verified = data.sender.verified;
	}
	var client_blocked = false;
	var hashtag_blocked = false;
	var mention_blocked = false;
	var user_blocked = false;
	var shown = false;
	if (output == "home" && content_stored[id])
	{
		shown = true;
	}
	if (output != "dms")
	{
		$w(store.get('client_blocks')).uniq().each(function(item)
		{
			if (item == source)
			{
				client_blocked = true;
				$break;
			}
		});
	}
	if (entities)
	{
		if (typeof(entities.hashtags) == "object")
		{
			$w(store.get('hashtag_blocks')).uniq().each(function(item)
			{
				entities.hashtags.uniq().each(function(tag)
				{
					if (item == tag)
					{
						hashtag_blocked = true;
						$break;
					}
				});
			});
		}
		if (typeof(entities.user_mentions) == "object")
		{
			$w(store.get('mention_blocks')).uniq().each(function(item)
			{
				entities.user_mentions.uniq().each(function(user)
				{
					if (item == user)
					{
						mention_blocked = true;
						$break;
					}
				});
			});
		}
	}
	$w(store.get('user_blocks')).uniq().each(function(item)
	{
		if (item == author)
		{
			user_blocked = true;
			$break;
		}
	});
	if (!shown && !client_blocked && !hashtag_blocked && !mention_blocked && !user_blocked)
	{
		content_stored[id] = JSON.stringify(data);
		var userinfo = "";
		if (description != null)
		{
				userinfo += description+'<br /><br />';
		}
		if (location != null)
		{
			userinfo += 'location: '+location+'<br />';
		}
		userinfo += 'tweets: <strong>'+tweets+'</strong><br />';
		userinfo += 'following: <strong>'+following+'</strong><br />';
		userinfo += 'followers: <strong>'+followers+'</strong>';
		var linebreak = new Element('br');
		if (!entities)
		{
			var mentioned = false;
			var mentions_string = false;
		}
		else
		{
			var mentioned = z_engine_tweet_mentioned(entities);
			var mentions_string = z_engine_tweet_mentioned_string(entities);
		}
		var container_element = new Element('li', {'id': 'comment-'+id, 'class': 'comment-parent', 'style': 'display: none; opacity: 0;'});
			var profile_wrapper_element = new Element('div', {'class': 'comment-profile-wrapper left'});
				var gravatar_element = new Element('div', {'class': 'comment-gravatar'});
					var gravatar_author_img_element = new Element('img', {'id': 'av-'+id, 'src': avatar, 'style': 'height: 50px; width: 50px; cursor: pointer;', 'alt': ''});
					gravatar_element.insert(gravatar_author_img_element);
				profile_wrapper_element.insert(gravatar_element);
			var comment_content_element = new Element('div', {'id': 'comment-'+id+'content', 'class': 'comment-content-wrapper right'});
			if (author != screen_name)
			{
				if (!mentioned)
				{
					var comment_body_element = new Element('div', {'class': 'comment-body'}); //regular shadow
				}
				else
				{
					var comment_body_element = new Element('div', {'class': 'comment-body-mentioned'}); //a noticeable red shadow
				}
			}
			else
			{
				var comment_body_element = new Element('div', {'class': 'comment-body-me'}); //a noticeable purple shadow
			}
					var comment_arrow_element = new Element('div', {'class': 'comment-arrow'});
					comment_body_element.insert(comment_arrow_element);
					var comment_date_element = new Element('div', {'class': 'post-date'});
						var left_element = new Element('div', {'class': 'left', 'id': 'left-'+id});
							var author_link_element = new Element('a', {'target': '_blank', href: 'http://twitter.com/'+author});
							author_link_element.update('@'+author+' ');
							var wrote_this_element = new Element('span');
							wrote_this_element.update('wrote this ');
							if (output != "dms")
							{
								var status_link_element = new Element('a', {'target': '_blank', 'id': 'comment-'+id+'-relative-date', href: 'http://twitter.com/'+author+'/status/'+id});
							}
							var status_time_element = new Element('time', {'datetime': date, 'class': output});
							status_time_element.update(relative_time(date));
							if (output != "dms")
							{
								status_link_element.insert(status_time_element);
							}
							left_element.insert(author_link_element);
							left_element.insert({'bottom': wrote_this_element});
							if (output != "dms")
							{
								left_element.insert({'bottom': status_link_element});
								if (replyid)
								{
									var in_reply_to_element = new Element('span');
									in_reply_to_element.update(' in reply to ');
									if (output == "threaded")
									{
										var in_reply_to_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+reply+'/status/'+replyid});
									}
									else
									{
										var in_reply_to_link_element = new Element('a', {'onclick': 'z_engine_threaded("'+id+'","'+replyid+'");', 'href': '#'});
									}
									in_reply_to_link_element.update(reply+' ');
									left_element.insert(in_reply_to_element);
									left_element.insert({'bottom': in_reply_to_link_element});
								}
								var via_source_element = new Element('span', {'class': 'via'});
								via_source_element.update(' via '+source);
								left_element.insert({'bottom': via_source_element});
							}
							else
							{
								left_element.insert({'bottom':status_time_element});
								if (reply)
								{
									var in_reply_to_element = new Element('span');
									in_reply_to_element.update(' in reply to ');
									var in_reply_to_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+reply});
									in_reply_to_link_element.update(reply+' ');
									left_element.insert(in_reply_to_element);
									left_element.insert({'bottom': in_reply_to_link_element});
								}
							}
							if (verified)
							{
								var verified_element = new Element('span');
								verified_element.update(" ");
								var verified_img_element = new Element('img', {'src': 'img/ver.png', 'alt': '', 'title': 'verified user'});
								verified_element.insert({'bottom': verified_img_element});
								left_element.insert({'bottom': verified_element});
							}
						comment_date_element.insert(left_element);
						var right_element = new Element('div', {'class': 'right'});
							if (rtd)
							{
								var rtd_element = new Element('span', {'class': 'rtd'});
								rtd_element.update(" ");
								var rtd_img_element = new Element('img', {'src': 'img/rtd2.png', 'alt': ''});
								var rtd_author_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+author2});
								rtd_author_link_element.update(author2);
								rtd_element.insert({'top': rtd_img_element});
								rtd_element.insert({'bottom': rtd_author_link_element});
								right_element.insert({'bottom': rtd_element});
							}
							if (output != "dms" && place && place.full_name)
							{
								var place_element = new Element('span', {'class': 'place'});
								var place_link_element = new Element('a', {'target': '_blank', href: 'http://maps.google.com?q='+place.full_name});
								var place_img_element = new Element('img', {'src': 'img/plc.png', 'alt': ''});
								place_link_element.update(place_img_element);
								place_element.update(place_link_element);
								right_element.insert({'bottom':place_element});
							}
						comment_date_element.insert({'bottom': right_element});
					comment_body_element.insert({'bottom': comment_date_element});
					var clearer_element = new Element('div', {'class': 'clearer'});
						clearer_element.update("&nbsp;");
					comment_body_element.insert({'bottom': clearer_element});
					var comment_text_element = new Element('div', {'class': 'comment-text'});
						var comment_text_body_element = new Element('p', {'id': 'comment-'+id+'-text'});
							var right2_element = new Element('div', {'id': 'right-'+id, 'class': 'right'});
							comment_text_body_element.insert(linebreak);
							comment_text_body_element.insert({'bottom': right2_element});
							var tweet_text = new Element('div', {'id': "text-"+id});
							tweet_text.update(z_engine_parse_tweet(text));
							comment_text_body_element.insert({'bottom': tweet_text});
						comment_text_element.insert(comment_text_body_element);
					comment_body_element.insert({'bottom': comment_text_element});
				comment_content_element.insert(comment_body_element);
			container_element.insert(profile_wrapper_element);
			container_element.insert({'bottom': comment_content_element});
			container_element.insert({'bottom': clearer_element});
		new Element.extend(left_element);
		new Element.extend(right2_element);
		new Element.extend(container_element);
		switch (output)
		{
			case 'dms':
				if (author != screen_name)
				{
					$("dms-inbox-timeline").insert({'top': container_element});
				}
				else if (author == screen_name)
				{
					$("dms-outbox-timeline").insert({'top': container_element});
				}
			break;
			case 'home':
				$("home-timeline").insert({'top': container_element});
			break;
			case 'mentions':
				$("mentions-timeline").insert({'bottom': container_element});
			break;
		}
		if (mentioned && output != "mentions" && author != screen_name && !data.retweeted_status)
		{
			left_element.setAttribute("id", "left-"+id+"-mentioned");
			right2_element.setAttribute("id", "right-"+id+"-mentioned");
			gravatar_author_img_element.setAttribute("id", "av-"+id+"-mentioned");
			var mentioned_clone = cloneNodeWithEvents(container_element);
			mentioned_clone.setAttribute("id", "comment-"+id+"-mentioned");
			new Element.extend(mentioned_clone);
			$("mentions-timeline").insert({'top': mentioned_clone});
			z_engine_tweet_buttons("mentions", id, author, userid, text, locked, faved, mentions_string, userinfo);
			if (output != "threaded")
			{
				z_engine_notification(avatar, "@"+author+" mentioned you!", text);
			}
			new S2.FX.Parallel(
			[
				new Effect.Appear('comment-'+id+'-mentioned',
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindDown('comment-'+id+'-mentioned',
				{
					duration: 0.7,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		}
		if (output == "threaded")
		{
			left_element.setAttribute("id", "left-"+id+"-threaded");
			right2_element.setAttribute("id", "right-"+id+"-threaded");
			gravatar_author_img_element.setAttribute("id", "av-"+id+"-threaded");
			var threaded_clone = cloneNodeWithEvents(container_element);
			threaded_clone.setAttribute("id", "comment-"+id+"-threaded");
			new Element.extend(threaded_clone);
			$("threaded-timeline").insert({'bottom': threaded_clone});
			new S2.FX.Parallel(
			[
				new Effect.Appear('comment-'+id+'-threaded',
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindDown('comment-'+id+'-threaded',
				{
					duration: 0.7,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		}
		z_engine_tweet_buttons(output, id, author, userid, text, locked, faved, mentions_string, userinfo);
		if (output != "threaded")
		{
			new S2.FX.Parallel(
			[
				new Effect.Appear('comment-'+id,
				{
					duration: 1.25,
					mode: 'relative',
					transition: 'easeOutSine'
				}),
				new Effect.BlindDown('comment-'+id,
				{
					duration: 0.7,
					mode: 'relative',
					transition: 'easeOutSine'
				})
			],
			{
				duration: 1.5
			});
		}
	}
	if (output == "threaded" && replyid)
	{
		z_engine_threaded(false, replyid);
	}
}

/* the reply / rt / fave buttons */
function z_engine_tweet_buttons(type, id, author, userid, text, locked, faved, usermentions, userinfo)
{
	switch (type)
	{
		case 'dms':
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'onclick': 'z_engine_reply_dm("'+userid+'", "'+author+'");', 'src': 'img/rep.png', 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				$("right-"+id).insert(reply_img_element);
			}
			var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "dm");', 'src': 'img/del.png', 'id': 'del-'+id, 'alt': ''});
			new Element.extend(del_img_element);
			$("right-"+id).insert({'bottom': del_img_element});
			if ($("av-"+id))
			{
				$("av-"+id).addTip(userinfo,
				{
					className: 'user',
					offset: [11, 0],
					stem: true,
					target: true,
					targetJoint: ['right', 'middle'],
					tipJoint: ['left', 'middle']
				});
			}
		break;
		case 'home':
			$("av-"+id).addTip(z_engine_parse_tweet(userinfo),
			{
				className: 'user',
				hideDelay: 3,
				showOn: 'click',
				offset: [11, 0],
				stem: true,
				target: true,
				targetJoint: ['right', 'middle'],
				tipJoint: ['left', 'middle']
			});
			if (!$('klout-'+id))
			{
				var klout_element = new Element('span', {'class': 'klout'});
				klout_element.update(" ");
				var klout_img_element = new Element('img', {'onclick': 'z_engine_get_klout("'+author+'", "'+id+'");', 'src': 'img/klt.png', 'id': 'klout-'+id, 'alt': '', 'title': 'click to get this users klout score'});
				klout_element.insert({'top': klout_img_element});
				new Element.extend(klout_img_element);
				$("left-"+id).insert({'top': klout_element});
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'", "'+author+'", "'+escape_string(text)+'");', 'id': 'rt-'+id, 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': 'img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': 'img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'id': 'fave-'+id, 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': 'img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'id': 'fave-'+id, 'alt': ''});
				}
				new Element.extend(fave_img_element);
				$("right-"+id).insert(reply_img_element);
				$("right-"+id).insert({'bottom': rt_img_element});
				$("right-"+id).insert({'bottom': fave_img_element});
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': 'img/del.png', 'id': 'del-'+id, 'alt': ''});
				new Element.extend(del_img_element);
				$("right-"+id).insert({'bottom': del_img_element});
			}
		break;
		case 'mentions':
			if ($("av-"+id))
			{
				$("av-"+id).addTip(userinfo,
				{
					className: 'user',
					offset: [11, 0],
					stem: true,
					target: true,
					targetJoint: ['right', 'middle'],
					tipJoint: ['left', 'middle']
				});
			}
			if ($("av-"+id+"-mentioned"))
			{
				$("av-"+id+"-mentioned").addTip(userinfo,
				{
					className: 'user',
					offset: [11, 0],
					stem: true,
					target: true,
					targetJoint: ['right', 'middle'],
					tipJoint: ['left', 'middle']
				});
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'-mentioned", "'+usermentions+'");', 'id': 'reply-'+id+'-mentioned', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'", "'+author+'", "'+escape_string(text)+'");', 'id': 'rt-'+id+'-mentioned', 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': 'img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': 'img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'id': 'fave-'+id+'-mentioned', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': 'img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'id': 'fave-'+id+'-mentioned', 'alt': ''});
				}
				new Element.extend(fave_img_element);
				if ($("right-"+id))
				{
					$("right-"+id).insert(reply_img_element);
					$("right-"+id).insert({'bottom': rt_img_element});
					$("right-"+id).insert({'bottom': fave_img_element});
				}
				if ($("right-"+id+"-mentioned"))
				{
					$("right-"+id+"-mentioned").insert(reply_img_element);
					$("right-"+id+"-mentioned").insert({'bottom': rt_img_element});
					$("right-"+id+"-mentioned").insert({'bottom': fave_img_element});
				}
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': 'img/del.png', 'id': 'del-'+id+'-mentioned', 'alt': ''});
				new Element.extend(del_img_element);
				if ($("right-"+id))
				{
					$("right-"+id).insert({'bottom': del_img_element});
				}
				if ($("right-"+id+"-mentioned"))
				{
					$("right-"+id+"-mentioned").insert({'bottom': del_img_element});
				}
			}
		break;
		case 'threaded':
			if ($("av-"+id+"-threaded"))
			{
				$("av-"+id+"-threaded").addTip(z_engine_parse_tweet(userinfo),
				{
					className: 'user',
					hideDelay: 3,
					showOn: 'click',
					offset: [11, 0],
					stem: true,
					target: true,
					targetJoint: ['right', 'middle'],
					tipJoint: ['left', 'middle']
				});
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'id': 'reply-'+id+'-threaded', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'", "'+author+'", "'+escape_string(text)+'");', 'id': 'rt-'+id+'-threaded', 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': 'img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': 'img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'id': 'fave-'+id+'-threaded', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': 'img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'id': 'fave-'+id+'-threaded', 'alt': ''});
				}
				new Element.extend(fave_img_element);
				if ($("right-"+id+"-threaded"))
				{
					$("right-"+id+"-threaded").insert(reply_img_element);
					$("right-"+id+"-threaded").insert({'bottom': rt_img_element});
					$("right-"+id+"-threaded").insert({'bottom': fave_img_element});
				}
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': 'img/del.png', 'id': 'del-'+id+'-threaded', 'alt': ''});
				new Element.extend(del_img_element);
				if ($("right-"+id+"-threaded"))
				{
					$("right-"+id+"-threaded").insert({'bottom': del_img_element});
				}
			}
		break;
	}
}

/* see if we were mentioned, this is faster than parsing through the text itself */
function z_engine_tweet_mentioned(entities)
{
	var mentioned = false;
	entities.user_mentions.uniq().each(function(item)
	{
		if (item.screen_name == screen_name)
		{
			mentioned = true;
			$break;
		}
	});
	return mentioned;
}

/* returns a premade string from all mentions in entities.user_mentions */
function z_engine_tweet_mentioned_string(entities)
{
	var mentioned_array = new Array();
	var mentioned = "";
	entities.user_mentions.uniq().each(function(item)
	{
		if (item.screen_name != screen_name && !mentioned_array[item.screen_name])
		{
			mentioned_array[item.screen_name] = true;
			mentioned += "@"+item.screen_name+" ";
		}
	});
	return mentioned;
}

/* tweets are temporarily stored and will be displayed when you click unpause */
function z_engine_tweet_pause()
{
	if (!paused)
	{
		paused = true;
		$("pause").update("unpause");
		$("paused-count").appear();
	}
	else
	{
		paused = false;
		$("paused-count").fade();
		$("paused-count").update("(0)");
		$("pause").update("pause");
		pttid = 0;
	}
}

/* favorite a tweet */
function z_engine_unfavorite(id)
{
	socket.emit("message", {unfavorite: {status: {id_str: id}}});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("src","img/fav.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("src","img/fav.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("src","img/fav.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
}

/* update all time elements */
function z_engine_update_relative_time(elements)
{
	var time_elements = $$(elements);
	time_elements.each(function(item)
	{
		var this_stamp = item.getAttribute("datetime");
		item.update(relative_time(this_stamp));
	});
}
