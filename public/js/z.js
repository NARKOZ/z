/* initial variables */
if (!store.get('client_blocks'))
{
	store.set('client_blocks', "");
}
store.set('connect_id', CONNECT_SID);
var check_ratelimit_interval = 300; //check every 5 minutes
var content_dms_queued = Array(); //outputs our dms tweets nicely
var content_mentions_queued = Array(); //outputs our mentions tweets nicely
var content_queued = Array(); //outputs our tweets nicely
var content_threads_queued = Array(); //outputs our threads tweets nicely
var content_stored = Array(); //stores all tweets
var dms_cutoff = 50; //max amount of tweets to display before pruning occurs on all dms
var dms_loaded = 0; //quick method to hide each dm timelines loading image without needing to write a ton of code to do it
var following = Array(); //holds our following id's array
var geo_high_accuracy = false; //disable high accuracy on geo readings
var geo_refresh_interval = 300; //refresh our geo
var geo_timeout = 120; //give to two minutes to figure out where you are
if (!store.get('hashtag_blocks'))
{
	store.set('hashtag_blocks', "");
}
var home_cutoff = 200; //max amount of tweets to display before pruning occurs on the home timeline
var klout = Array(); //holds klout data
var kloutinfo_params = {
	className: 'klout',
	stem: true,
	target: true,
	targetJoint: ['left', 'top'],
	tipJoint: ['right', 'bottom']
}
var latest_threaded_id = 0;
var latitude = false; //hold our latitude
var loaded = false; //not loaded
var longitude = false; //hold our longitude
var max_file_size = 2; //in megabytes
if (!store.get('mention_blocks'))
{
	store.set('mention_blocks', "");
}
var mentions_cutoff = 100; //max amount of tweets to display before pruning occurs on the mentions timeline
var paused = false; //allow the engine itself to be momentarily 'paused'..not sure how im going to work this out properly
var prune_tweets_interval = 60; //start the pruning loop over again every minute
var pttid = 0; //this serves as the (#) amount displayed when paused
var rates = "";
var remember_cutoff = 199; //the maximum amount of names to store for autocompletion
var reply_id = false; //catch reply
var screen_name = ""; //our own screen name
var shortened = false;
var socket = io.connectWithSession();
if (!store.get('sound'))
{
	store.set('sound', "on");
}
if (!store.get('sound-src'))
{
	if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Safari")
	{
		store.set('sound-src', "/audio/notify.mp3"); //use mp3 for ie and safari
	}
	else
	{
		store.set('sound-src', "/audio/notify.ogg");
	}
}
if (store.get('sound') == "on")
{
	var audio = new Audio();
	audio.src = store.get('sound-src'); //and ogg for anyone else who supports the audio api
}
var stream_queue_interval = 1.5; //every one and a half seconds
var threaded_cutoff = 50; //max amount of tweets to display before pruning occurs on the threaded timeline
var update_relative_dms_interval = 60; //once a minute
var update_relative_home_interval = 15; //every 15 seconds
var update_relative_mentions_interval = 30; //every 30 seconds
var user_id = 0; //our own user id
var userinfo_params = {
	className: 'user',
	hideDelay: 3,
	showOn: 'click',
	offset: [11, 0],
	stem: true,
	target: true,
	targetJoint: ['right', 'middle'],
	tipJoint: ['left', 'middle']
}
if (!store.get('user_blocks'))
{
	store.set('user_blocks', "");
}
if (!store.get('users'))
{
	store.set('users', "");
}

/* determine if we should start the engine */
if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Firefox" && BrowserDetect.version >= 3.6 || BrowserDetect.browser == "Chrome" || BrowserDetect.browser == "Opera" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Safari")
{
	z_engine_attrition(); //call the below function
}
else
{
	$("new-tweet").setValue("sorry, your browser may not support this client!");
}

/* the websocket itself */
function z_engine_attrition()
{
	if (!loaded)
	{
		new Event.observe("logout","click",function(event)
		{
			Event.stop(event);
			z_engine_logout();
		});
		$("loading-home").center(8);
		$("loading-mentions").center(8);
		$("loading-inbox").center(8);
		$("loading-outbox").center(8);
	}
	socket.on("connect",function()
	{
		if (!loaded)
		{
			$("new-tweet").setValue("connected...");
			z_engine_geo();
		}
	});
	socket.on("message", function(json)
	{
		var string = JSON.stringify(json);
		if (string.isJSON() && string.evalJSON(true)) //quick sanity check before we begin
		{
			string = ""; //dont need it anymore
			if (json.loaded && !loaded)
			{
				loaded = true;
				$("new-tweet").setValue("");
				$("new-tweet").enable();
				z_engine_clicker("home-timeline-click", "home-timeline");
				z_engine_clicker("mentions-timeline-click", "mentions-timeline");
				z_engine_clicker("dms-inbox-timeline-click", "dms-inbox-timeline");
				z_engine_clicker("dms-outbox-timeline-click", "dms-outbox-timeline");
				z_engine_check_ratelimit();
				socket.emit("message", {fetch: "home"});
				setTimeout(function()
				{
					socket.emit("message", {fetch: "mentions"});
				}, 10000);
				setTimeout(function()
				{
					socket.emit("message", {fetch: "dms-inbox"});
				}, 20000);
				setTimeout(function()
				{
					socket.emit("message", {fetch: "dms-outbox"});
				}, 30000);
				setInterval(function()
				{
					z_engine_check_ratelimit();
				}, check_ratelimit_interval * 1000);
				setInterval(function()
				{
					z_engine_update_relative_time("time.home");
				}, update_relative_home_interval * 1000);
				setInterval(function()
				{
					z_engine_update_relative_time("time.mentions");
				}, update_relative_mentions_interval * 1000);
				setInterval(function()
				{
					z_engine_update_relative_time("time.dms");
				}, update_relative_dms_interval * 1000);
				setInterval(function()
				{
					z_engine_update_relative_time("time.threaded");
				}, update_relative_home_interval * 1000);
				setInterval(function()
				{
					if (!paused)
					{
						z_engine_prune_tweets();
					}
				}, prune_tweets_interval * 1000);
				setInterval(function()
				{
					if (!paused)
					{
						z_engine_stream_queue();
					}
				}, stream_queue_interval * 1000);
				setInterval(function()
				{
					z_engine_geo();
				}, geo_refresh_interval * 1000);
				var autocomplete_users = $w(store.get('users').strip()).uniq();
				var autocomplete_users_dm = "";
				autocomplete_users.each(function(item)
				{
					autocomplete_users_dm += item.replace(/@/i,"")+" ";
				});
				new Autocompleter.Local("new-tweet", "autocompleter", autocomplete_users,
				{
					choices: 20,
					minChars: 2,
					tokens: ' ',
					afterUpdateElement: function(item)
					{
						$("new-tweet").setValue($("new-tweet").getValue()+" ");
					}
				});
				new Autocompleter.Local("new-dm-user", "autocompleter-dm", $w(autocomplete_users_dm.strip()).uniq(),
				{
					choices: 20,
					minChars: 2
				});
				new HotKey('c',function(event)
				{
					z_engine_clear_timeline();
				},
				{
					shiftKey: true
				});
				new HotKey('g',function(event)
				{
					z_engine_geo();
				},
				{
					shiftKey: true
				});
				new HotKey('p',function(event)
				{
					z_engine_tweet_pause();
				},
				{
					shiftKey: true
				});
				new HotKey('s',function(event)
				{
					z_engine_shorten_urls();
				},
				{
					shiftKey: true
				});
				new Event.observe("new-tweet","keyup",function(event)
				{
					if($("new-tweet").getValue().length == 0)
					{
						reply_id = false;
						shortened = false;
					}
					else if($("new-tweet").getValue().length <= 140)
					{
						$("new-tweet").setStyle("color: #4d4d4d;");
					}
					else if($("new-tweet").getValue().length >= 141)
					{
						z_engine_shorten_urls();
						$("new-tweet").setStyle("color: red;");
					}
				});
				new Event.observe("new-tweet","keydown",function(event)
				{
					if($("new-tweet").getValue().length == 0)
					{
						reply_id = false;
						shortened = false;
					}
					else if($("new-tweet").getValue().length <= 140)
					{
						$("new-tweet").setStyle("color: #4d4d4d;");
					}
					else if($("new-tweet").getValue().length >= 141)
					{
						z_engine_shorten_urls();
						$("new-tweet").setStyle("color: red;");
					}
				});
				new Event.observe("new-tweet-form", "submit", function(event)
				{
					Event.stop(event);
					z_engine_send_tweet();
				});
				new Event.observe("pause", "click", function(event)
				{
					Event.stop(event);
					z_engine_tweet_pause();
				});
				z_engine_image_dropper();
				z_engine_notification_setup();
			}
			else if (json.loaded && loaded)
			{
				$("new-tweet").enable();
			}
			else if (json["delete"]) //catch it like this, it can cause errors in other browsers like opera
			{
				if (typeof(json["delete"].status) == "object")
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
					var av = json.direct_message.sender.profile_image_url;
					var text = json.direct_message.text;
					var title = "@"+json.direct_message.sender.screen_name+" sent a direct message";
					z_engine_notification(av, title, text);
				}
			}
			else if (json.dms) //realtime dms DO NOT come through here, this is the initial 50 that we throw in there
			{
				dms_loaded++;
				json.dms.each(function(item)
				{
					content_dms_queued.push(JSON.stringify(item));
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
				switch (json.event)
				{
					case 'block':
						var mention_blocks = $w(store.get('mention_blocks')).uniq().strip();
						var user_blocks = $w(store.get('user_blocks')).uniq().strip();
						var mention_exists = false;
						var user_exists = false;
						mention_blocks.each(function(item)
						{
							if (item == json.target.screen_name)
							{
								mention_exists = true;
								$break;
							}
						});
						user_blocks.each(function(item)
						{
							if (item == json.target.screen_name)
							{
								user_exists = true;
								$break;
							}
						});
						if (!mention_exists)
						{
							store.set('mention_blocks', current_blocks.join(" ")+" "+json.target.screen_name);
						}
						if (!user_exists)
						{
							store.set('user_blocks', current_blocks.join(" ")+" "+json.target.screen_name);
						}
					break;
					case 'unblock':
						var mention_blocks = $w(store.get('user_blocks')).uniq().strip();
						var user_blocks = $w(store.get('user_blocks')).uniq().strip();
						var new_mention_blocks = "";
						var new_user_blocks = "";
						mention_blocks.each(function(item)
						{
							if (item != json.target.screen_name)
							{
								new_mention_blocks += item+" ";
							}
						});
						user_blocks.each(function(item)
						{
							if (item != json.target.screen_name)
							{
								new_user_blocks += item+" ";
							}
						});
						store.set('mention_blocks', new_mention_blocks);
						store.set('user_blocks', new_user_blocks);
					break;
					case 'favorite':
						if (json.source.screen_name != screen_name)
						{
							var av = json.source.profile_image_url;
							var text = json.target_object.text;
							var title = "@"+json.source.screen_name+" faved your tweet!";
							z_engine_notification(av, title, text);
						}
					break;
					case 'unfavorite':
					break;
					case 'follow':
						if (json.source.screen_name != screen_name)
						{
							var av = json.source.profile_image_url;
							var text = json.source.description;
							var title = "@"+json.source.screen_name+" is following you!";
							z_engine_notification(av, title, text);
						}
					break;
					case 'list_member_added':
						if (json.source.screen_name != screen_name)
						{
							var av = json.source.profile_image_url;
							var text = json.target_object.description;
							var title = "@"+json.source.screen_name+" put you in "+json.target_object.full_name+"!";
							z_engine_notification(av, title, text);
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
							var av = json.source.profile_image_url;
							var text = json.target_object.description;
							var title = "@"+json.source.screen_name+" subscribed to "+json.target_object.full_name+"!";
							z_engine_notification(av, title, text);
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
					content_queued.push(JSON.stringify(item));
				});
				$("loading-home").fade();
				$("loading-mentions").appear();
				socket.emit("message", {fetch: "userstream"});
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
				if (data != "error")
				{
					z_engine_set_klout(data.users, id);
					var userid = data.users[0].twitter_id;
					klout[userid] = JSON.stringify(data.users);
				}
				else
				{
					if ($("klout-"+id))
					{
						$("klout-"+id).setStyle('cursor: default;');
						$("klout-"+id).setAttribute('onclick', '');
						$("klout-"+id).addTip('<big><strong>?</strong></big>', kloutinfo_params);
					}
				}
			}
			else if (json.mentions) //realtime mentions DO NOT come through here, this is the initial 50 that we throw in there
			{
				json.mentions.each(function(item)
				{
					content_mentions_queued.push(JSON.stringify(item));
				});
				$("loading-mentions").fade();
				$("loading-inbox").appear();
			}
			else if (json.rates)
			{
				rates = JSON.stringify(json.rates);
				if (json.rates.remaining_hits <= 10)
				{
					z_engine_notification("","notice!","you have "+json.rates.remaining_hits+" (of "+json.rates.hourly_limit+") request tokens left!");
				}
			}
			else if (json.retweet_info)  //catch what we just retweeted, change the clicking event and icon
			{
				var data = json.retweet_info;
				var author = data.retweeted_status.user.screen_name;
				var entities = data.retweeted_status.entities;
				var faved = data.retweeted_status.favorited;
				var id = data.retweeted_status.id_str;
				var locked = data.retweeted_status.user["protected"];
				var this_id = data.id_str;
				var userid = data.retweeted_status.user.id;
				if (!entities)
				{
					var usermentions = false;
				}
				else
				{
					var usermentions = z_engine_tweet_mentioned_string(entities);
				}
				if ($("rt-"+id))
				{
					$("rt-"+id).writeAttribute("src","img/rtd.png");
					$("rt-"+id).writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
					z_engine_tweet_right_click(this_id, "rt-"+id, author, userid, usermentions, faved, true, locked, "home");
				}
				if ($("rt-"+id+"-mentioned"))
				{
					$("rt-"+id+"-mentioned").writeAttribute("src","img/rtd.png");
					$("rt-"+id+"-mentioned").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
					z_engine_tweet_right_click(this_id, "rt-"+id+"-mentioned", author, userid, usermentions, faved, true, locked, "mentions");
				}
				if ($("rt-"+id+"-threaded"))
				{
					$("rt-"+id+"-threaded").writeAttribute("src","img/rtd.png");
					$("rt-"+id+"-threaded").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
					z_engine_tweet_right_click(this_id, "rt-"+id+"-threaded", author, userid, usermentions, faved, true, locked, "threaded");
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
						z_engine_notification("", "notice!", "error occurred, reconnecting...");
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
				content_threads_queued.push(JSON.stringify(json.show));
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
					var av = json.user.profile_image_url;
					var rtd = json.retweeted_status.retweet_count - 1;
					var text = json.retweeted_status.text;
					if (rtd > 1)
					{
						var title = "@"+json.user.screen_name+" and "+rtd+" others rt'd you!";
					}
					else if (rtd == 1)
					{
						var title = "@"+json.user.screen_name+" and 1 other rt'd you!";
					}
					else
					{
						var title = "@"+json.user.screen_name+" retweeted you!";
					}
					z_engine_notification(av, title, text);
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
	});
}

/* check the ratelimits */
function z_engine_check_ratelimit()
{
	socket.emit("message", {fetch: "rates"});
}

/* clear the current timeline */
function z_engine_clear_timeline()
{
	var visible = z_engine_current_timeline();
	if (!z_engine_css3())
	{
		new Effect.Fade(visible,
		{
			duration: 0.5,
			afterFinish: function()
			{
				$(visible).update().appear();
			}
		});
	}
	else
	{
		$(visible).addClassName("comment-parent-drop").removeClassName("comment-parent");
		setTimeout(function()
		{
			$(visible).update().appear();
		});
	}
}

function z_engine_current_timeline()
{
	if ($("home-timeline").visible())
	{
		return "home-timeline";
	}
	else if ($("mentions-timeline").visible())
	{
		return "mentions-timeline";
	}
	else if ($("threaded-timeline").visible())
	{
		return "threaded-timeline";
	}
	else if ($("dms-inbox-timeline").visible())
	{
		return "dms-inbox-timeline";
	}
	if ($("dms-outbox-timeline").visible())
	{
		return "dms-outbox-timeline";
	}
}

/* the "home", "mentions", "messages", etc switcher */
function z_engine_clicker(id, this_id)
{
	new Event.observe(id, "click", function(event)
	{
		Event.stop(event);
		var hide = z_engine_current_timeline();
		if (!$(this_id).visible())
		{
			if (!z_engine_css3())
			{
				$(hide).removeClassName("current-tab");
				$(this_id).addClassName("current-tab");
				new Effect.Parallel(
				[
					new Effect.Fade(hide,
					{
						duration: 0.5,
						mode: 'relative'
					}),
					new Effect.Appear(this_id,
					{
						delay: 0.51,
						duration: 0.5,
						mode: 'relative'
					})
				],
				{
					duration: 1,
					beforeStart: function()
					{
						switch (this_id)
						{
							case "dms-inbox-timeline":
							case "dms-outbox-timeline":
								$("new-dm-user").appear();
							break;
							default:
								$("new-dm-user").fade();
							break;
						}
					},
					afterFinish: function()
					{
						if (hide == "threaded-timeline")
						{
							$("threaded-timeline").update();
							latest_threaded_id = 0;
						}
					}
				});
			}
			else
			{
				switch (this_id)
				{
					case "dms-inbox-timeline":
					case "dms-outbox-timeline":
						$("new-dm-user").addClassName("shower").removeClassName("hider");
					break;
					default:
						$("new-dm-user").addClassName("hider").removeClassName("shower");
					break;
				}
				$(hide).addClassName("hider").removeClassName("shower");
				setTimeout(function()
				{
					$(this_id).addClassName("shower").removeClassName("hider");
					if (hide == "threaded-timeline")
					{
						$("threaded-timeline").update();
						latest_threaded_id = 0;
					}
				},500);
			}
		}
	});
}

/* check to see if css3 is possible */
function z_engine_css3()
{
	if (BrowserDetect.browser == "Firefox" && BrowserDetect.version <= 5 || BrowserDetect.browser != "Chrome" || BrowserDetect.browser != "Safari")
	{
		return false;
	}
	else
	{
		return true; //css3 animations are supported
	}
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
			//todo: get menus to be reset from here as well
		}
		socket.emit("message", params);
	}
}

/* drop tweet */
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
			z_engine_fade_up("comment-"+id);
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
			z_engine_fade_up("comment-"+id+"-mentioned");
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
			z_engine_fade_up("comment-"+id+"-threaded");
		},3000);
	}
}

/* convert entities, etc */
function z_engine_escape(text)
{
	var escaped = new Element('textarea').update(text.replace(/</g,"&lt;").replace(/>/g,"&gt;").strip());
	return escaped.getValue();
}

/* the fading + blind down animation */
function z_engine_fade_down(id)
{
	if (!z_engine_css3())
	{
		$(id).setStyle("display: none;");
		new Effect.Appear(id,
		{
			duration: 1,
			transition: Effect.Transitions.sinoidal
		});
	}
}

/* the fading + blind up animation */
function z_engine_fade_up(id)
{
	if (!z_engine_css3())
	{
		new Effect.Fade(id,
		{
			duration: 1,
			transition: Effect.Transitions.sinoidal
		});
	}
	else
	{
		$(id).addClassName("comment-parent-drop").removeClassName("comment-parent");
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

/* get geolocation information */
function z_engine_geo()
{
	if (navigator.geolocation)
	{
		navigator.geolocation.getCurrentPosition(z_engine_geo_set, z_engine_geo_error,
		{
			enableHighAccuracy: geo_high_accuracy,
			maximumAge: 0,
			timeout: geo_timeout * 1000
		});
	}
}


/* handle geo errors down here */
function z_engine_geo_error(error)
{
	switch (error.code)
	{
		case 0: //unknown error
		case 1: //denied
		case 2: //unavailable
		case 3: //timeout
			latitude = false;
			longitude = false;
		break;
	}
}

/* set the geolocation vars */
function z_engine_geo_set(position)
{
	latitude = position.coords.latitude;
	longitude = position.coords.longitude;
}

/* automatically determine if the browser supports file dropping */
function z_engine_image_dropper()
{
	if (window.File && window.FileReader && window.FileList && window.Blob)
	{
		$("image").show();
		$("image").ondragover = function(event)
		{
			event.preventDefault();
			$("image").setStyle("border-color: #aaa;");
			return false;
		}
		$("image").ondragend = function(event)
		{
			event.preventDefault();
			$("image").setStyle("border-color: #ddd;");
			return false;
		}
		$("image").ondrop = function(event)
		{
			event.preventDefault();
			var image = event.dataTransfer.files[0];
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
						var xhr = new XMLHttpRequest(); //this would be written in prototypes ajax method but only this works
						xhr.onreadystatechange = function()
						{
							if(this.readyState == 3 || this.readyState == 2)
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
			return false;
		}
		$("image").ondragleave = function(event)
		{
			event.preventDefault();
			$("image").setStyle("border-color: #ddd;");
			return false;
		}
	}
}

/* get a users klout score */
function z_engine_get_klout(author, userid, id)
{
	if (!klout[userid])
	{
		socket.emit("message", {klout: author, id_str: id});
	}
	else
	{
		var data = klout[userid].evalJSON(true);
		z_engine_set_klout(data, id);
	}
}

/* properly log out a user */
function z_engine_logout()
{
	socket.disconnect();
	$("new-tweet").disable();
	$("new-tweet").setValue("see ya!");
	store.remove('friends');
	store.remove('screen_name');
	store.remove('user_id');
	window.location = "/oauth/logout";
}

/* send a notification to the client */
function z_engine_notification(av, title, text)
{
	if ((store.get('sound') == "on") && (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser != "MSIE"))
	{
		audio.play();
	}
	if (text == null)
	{
		text = "";
	}
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) //we can access webkit notifications
	{
		var notification = window.webkitNotifications.createNotification(av, title, text);
		notification.show();
		setTimeout(function()
		{
			notification.cancel();
		},5000);
	}
	else if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1) //we might be able to access them if the user allows us to
	{
		window.webkitNotifications.requestPermission();
		growler.growl(title, text); //send a growler notification anyway
	}
	else if (!window.webkitNotifications || window.webkitNotifications && window.webkitNotifications.checkPermission() == 2) //we cant access notifications
	{
		//todo: support avatars in here as well
		growler.growl(title, text);
	}
}

/* currently for webkit browsers only (requests permission to use webkit notifications) */
function z_engine_notification_setup()
{
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1)
	{
		window.webkitNotifications.requestPermission();
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
	if (tweet_elements.length >= home_cutoff)
	{
		tweet_elements.each(function(item, index)
		{
			if (index > home_cutoff)
			{
				$(item).remove();
			}
		});
	}
	setTimeout(function()
	{
		var mention_elements = $("mentions-timeline").childElements();
		if (mention_elements.length >= mentions_cutoff)
		{
			mention_elements.each(function(item, index)
			{
				if (index > mentions_cutoff)
				{
					$(item).remove();
				}
			});
		}
	},10000);
	setTimeout(function()
	{
		var dm_elements = $("dms-inbox-timeline").childElements();
		if (dm_elements.length >= dms_cutoff)
		{
			dm_elements.each(function(item, index)
			{
				if (index > dms_cutoff)
				{
					$(item).remove();
				}
			});
		}
	},20000);
	setTimeout(function()
	{
		var dm_sent_elements = $("dms-outbox-timeline").childElements();
		if (dm_sent_elements.length >= dms_cutoff)
		{
			dm_sent_elements.each(function(item, index)
			{
				if (index > dms_cutoff)
				{
					$(item).remove();
				}
			});
		}
	},30000);
	setTimeout(function()
	{
		var threaded_elements = $("threaded-timeline").childElements();
		if (threaded_elements.length >= threaded_cutoff)
		{
			threaded_elements.each(function(item, index)
			{
				if (index > threaded_cutoff)
				{
					$(item).remove();
				}
			});
		}
	},40000);
}

/* remember usernames (autocompleter related) */
function z_engine_remember_author(author)
{
	author = "@"+author;
	var new_users = "";
	var user_found = false;
	var users = $w(store.get('users')).uniq().compact();
	users.each(function(item, index)
	{
		if (index <= remember_cutoff)
		{
			if (item == author)
			{
				user_found = true;
			}
			else
			{
				new_users += " "+item;
			}
		}
		else
		{
			$break;
		}
	});
	if (!user_found)
	{
		new_users = author+" "+new_users;
	}
	store.set('users', new_users.strip());
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
	$("new-dm-user").setValue(user);
	$("new-tweet").focus();
}

/* retweet a tweet (official way) */
function z_engine_retweet(id)
{
	socket.emit("message", {retweet: {status: {id_str: id}}});
}

/* retweet a tweet (old way) */
function z_engine_retweet_comment(id, author, text)
{
	reply_id = id; //set this as a reply, it looks nicer
	$("new-tweet").setValue("RT @"+author+" "+z_engine_escape(text));
	$("new-tweet").focus();
	escaped = "";
}

/* send our tweet */
function z_engine_send_tweet()
{
	if ($("new-tweet").getValue().length > 0 && $("new-tweet").getValue().length <= 140)
	{
		$("new-tweet").disable();
		var temp_element = $("new-tweet").getValue().strip();
		var temp_user_element = $("new-dm-user").getValue().strip();
		var send = new Hash();
		if (temp_user_element.length > 0) //handle dm
		{
			if (temp_user_element.startsWith("@"))
			{
				temp_user_element = temp_user_element.replace(/@/i,"");
			}
			var send = {
				direct_message: {
					screen_name: temp_user_element,
					text: temp_element
				}
			}
		}
		else
		{
			var send = {
				status: {
					status: temp_element,
					include_entities: true
				}
			}
			if (latitude && longitude)
			{
				var geo = {
					display_coordinates: true,
					lat: latitude,
					'long': longitude
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
		socket.emit("message", send);
		reply_id = false;
		shortened = false;
		$("new-dm-user").setValue("");
		$("new-tweet").setValue("");
		$("new-tweet").enable();
		$("new-tweet").focus();
	}
}

/* set the klout icon up properly */
function z_engine_set_klout(data, id)
{
	if (typeof(data) == "object")
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
			var kloutinfo = 'score: <strong>'+kscore+'</strong><br />';
			kloutinfo += 'amp: <strong>'+amp+'</strong><br />';
			kloutinfo += 'network: <strong>'+net+'</strong><br />';
			kloutinfo += 'reach: <strong>'+reach+'</strong><br />';
			if ($("klout-"+id))
			{
				$("klout-"+id).addTip(kloutinfo, kloutinfo_params);
				$("klout-"+id).setAttribute('src', 'img/kltd.png');
				$("klout-"+id).setAttribute('title', '');
			}
			if ($("klout-"+id+"-mentioned"))
			{
				$("klout-"+id+"-mentioned").addTip(kloutinfo, kloutinfo_params);
				$("klout-"+id+"-mentioned").setAttribute('src', 'img/kltd.png');
				$("klout-"+id+"-mentioned").setAttribute('title', '');
			}
		}
	}
}

/* shorten urls */
function z_engine_shorten_urls()
{
	var current_tweet = $("new-tweet").getValue();
	if (current_tweet.length > 0 && !shortened)
	{
		current_tweet.replace(/((https?\:\/\/)|(www\.))([^ \(\)\{\}\[\]]+)/g,function(url)
		{
			if (url.length >= 20)
			{
				socket.emit("message", {shorten: url});
			}
		});
		shortened = true;
	}
}

/* streamlines our timelines nicely by outputting only one tweet every second or so */
function z_engine_stream_queue()
{
	if (content_queued.length > 0)
	{
		var queue = content_queued.shift();
		if (typeof(queue) == "string")
		{
			if (queue.isJSON())
			{
				var data = queue.evalJSON(true);
				z_engine_tweet(data, "home");
			}
		}
	}
	if (content_mentions_queued.length > 0)
	{
		var queue = content_mentions_queued.shift();
		if (typeof(queue) == "string")
		{
			if (queue.isJSON())
			{
				var data = queue.evalJSON(true);
				z_engine_tweet(data, "mentions");
			}
		}
	}
	if (content_dms_queued.length > 0)
	{
		var queue = content_dms_queued.shift();
		if (typeof(queue) == "string")
		{
			if (queue.isJSON())
			{
				var data = queue.evalJSON(true);
				z_engine_tweet(data, "dms");
			}
		}
	}
	if (content_threads_queued.length > 0)
	{
		var queue = content_threads_queued.shift();
		if (typeof(queue) == "string")
		{
			if (queue.isJSON())
			{
				var data = queue.evalJSON(true);
				z_engine_tweet(data, "threaded");
			}
		}
	}
}

/* the threaded engine */
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
		if (!z_engine_css3())
		{
			new Effect.Parallel(
			[
				new Effect.Fade(hide,
				{
					duration: 0.5,
					mode: 'relative'
				}),
				new Effect.Appear("threaded-timeline",
				{
					delay: 0.51,
					duration: 0.5,
					mode: 'relative'
				})
			],
			{
				duration: 1
			});
		}
		else
		{
			$(hide).addClassName("hider").removeClassName("shower");
			setTimeout(function()
			{
				$("threaded-timeline").addClassName("shower").removeClassName("hider");
			}, 500);
		}
		socket.emit("message", {show: {id_str: init}});
	}
	else
	{
		socket.emit("message", {show: {id_str: id}}); //continue the loop until nothing is left
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
			var locked = data.user["protected"];
			var name = data.user.name;
			var place = data.place;
			var reply = data.in_reply_to_screen_name;
			var replyid = data.in_reply_to_status_id_str;
			var retweet_count = data.retweet_count - 1;
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
			var locked = data.retweeted_status.user["protected"];
			var name = data.retweeted_status.user.name;
			var place = data.retweeted_status.place;
			var reply = data.retweeted_status.in_reply_to_screen_name;
			var replyid = data.retweeted_status.in_reply_to_status_id_str;
			var retweet_count = data.retweeted_status.retweet_count - 1;
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
		var retweet_count = 0;
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
	if (output != "threaded" && content_stored[id])
	{
		shown = true;
	}
	if (output != "dms")
	{
		$w(store.get('client_blocks')).uniq().each(function(item)
		{
			if (item.replace("'","") == source)
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
		(new Image()).src = avatar; //load av in the background
		content_stored[id] = true;
		z_engine_remember_author(author);
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
		var linebreak = new Element('br');
		if (output != "dms")
		{
			var container_element = new Element('div', {'ondblclick': 'z_engine_reply("'+author+'", "'+id+'", "'+mentions_string+'");', 'id': 'comment-'+id, 'class': 'comment-parent'});
		}
		else
		{
			var container_element = new Element('div', {'ondblclick': 'z_engine_reply_dm("'+userid+'", "'+author+'");', 'id': 'comment-'+id, 'class': 'comment-parent'});
		}
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
										var in_reply_to_link_element = new Element('span', {'onclick': 'z_engine_threaded("'+id+'","'+replyid+'");', 'style': 'cursor: pointer;'});
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
								if (retweet_count > 0)
								{
									var rt_title = "retweeted by "+author2+" and "+retweet_count+" others!";
								}
								else
								{
									var rt_title = "retweeted by "+author2+"!";
								}
								var rtd_element = new Element('span', {'class': 'rtd'});
								rtd_element.update(" ");
								var rtd_img_element = new Element('img', {'src': 'img/rtd2.png', 'alt': '', 'title': rt_title});
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
		new Element.extend(gravatar_author_img_element);
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
				$("mentions-timeline").insert({'top': container_element});
			break;
		}
		if (mentioned && output != "mentions" && output != "threaded" && author != screen_name && !data.retweeted_status)
		{
			var mentioned_clone = cloneNodeWithEvents(container_element);
			mentioned_clone.setAttribute("id", "comment-"+id+"-mentioned");
			left_element.setAttribute("id", "left-"+id+"-mentioned");
			right2_element.setAttribute("id", "right-"+id+"-mentioned");
			gravatar_author_img_element.setAttribute("id", "av-"+id+"-mentioned");
			new Element.extend(mentioned_clone);
			$("mentions-timeline").insert({'top': mentioned_clone});
			z_engine_tweet_buttons("mentions", id, author, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id+"-mentioned");
			z_engine_notification(avatar, "@"+author+" mentioned you!", text);
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
			z_engine_tweet_buttons("threaded", id, author, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id+"-threaded");
		}
		if ($("comment-"+id))
		{
			z_engine_tweet_buttons(output, id, author, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id);
		}
	}
	if (output == "threaded" && replyid)
	{
		z_engine_threaded(false, replyid);
	}
}

/* the reply / rt / fave / delete / klout buttons */
function z_engine_tweet_buttons(type, id, author, userid, text, locked, faved, rtd, usermentions, userinfo)
{
	switch (type)
	{
		case 'dms':
			if ($("av-"+id))
			{
				$("av-"+id).addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'onclick': 'z_engine_reply_dm("'+userid+'", "'+author+'");', 'src': 'img/rep.png', 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				$("right-"+id).insert(reply_img_element);
			}
			var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "dm");', 'src': 'img/del.png', 'id': 'del-'+id, 'alt': ''});
			new Element.extend(del_img_element);
			$("right-"+id).insert({'bottom': del_img_element});
			z_engine_tweet_right_click(id, "comment-"+id, author, userid, usermentions, faved, rtd, locked, type);
		break;
		case 'home':
			if ($("av-"+id))
			{
				$("av-"+id).addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if ($("left-"+id) && !$('klout-'+id))
			{
				var klout_element = new Element('span', {'class': 'klout'});
				klout_element.update(" ");
				var klout_img_element = new Element('img', {'onclick': 'z_engine_get_klout("'+author+'", "'+userid+'", "'+id+'");', 'src': 'img/klt.png', 'id': 'klout-'+id, 'alt': '', 'title': 'click to get this users klout score'});
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
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'id': 'rt-'+id, 'alt': ''});
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
				$("right-"+id).update();
				$("right-"+id).insert(reply_img_element);
				$("right-"+id).insert({'bottom': rt_img_element});
				$("right-"+id).insert({'bottom': fave_img_element});
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': 'img/del.png', 'id': 'del-'+id, 'alt': ''});
				new Element.extend(del_img_element);
				$("right-"+id).update();
				$("right-"+id).insert({'bottom': del_img_element});
			}
			z_engine_tweet_right_click(id, "comment-"+id, author, userid, usermentions, faved, rtd, locked, type);
		break;
		case 'mentions':
			if ($("av-"+id+"-mentioned"))
			{
				$("av-"+id+"-mentioned").addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if ($("left-"+id+"-mentioned") && !$('klout-'+id+'-mentioned'))
			{
				var klout_element = new Element('span', {'class': 'klout'});
				klout_element.update(" ");
				var klout_img_element = new Element('img', {'onclick': 'z_engine_get_klout("'+author+'", "'+userid+'", "'+id+'");', 'src': 'img/klt.png', 'id': 'klout-'+id+'-mentioned', 'alt': '', 'title': 'click to get this users klout score'});
				klout_element.insert({'top': klout_img_element});
				new Element.extend(klout_img_element);
				$("left-"+id+"-mentioned").insert({'top': klout_element});
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'-mentioned", "'+usermentions+'");', 'id': 'reply-'+id+'-mentioned', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'id': 'rt-'+id+'-mentioned', 'alt': ''});
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
					$("right-"+id).update();
					$("right-"+id).insert(reply_img_element);
					$("right-"+id).insert({'bottom': rt_img_element});
					$("right-"+id).insert({'bottom': fave_img_element});
				}
				if ($("right-"+id+"-mentioned"))
				{
					$("right-"+id+"-mentioned").update();
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
					$("right-"+id).update();
					$("right-"+id).insert({'bottom': del_img_element});
				}
				if ($("right-"+id+"-mentioned"))
				{
					$("right-"+id+"-mentioned").update();
					$("right-"+id+"-mentioned").insert({'bottom': del_img_element});
				}
			}
			z_engine_tweet_right_click(id, "comment-"+id+"-mentioned", author, userid, usermentions, faved, rtd, locked, type);
		break;
		case 'threaded':
			if ($("av-"+id+"-threaded"))
			{
				$("av-"+id+"-threaded").addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'id': 'reply-'+id+'-threaded', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': 'img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'id': 'rt-'+id+'-threaded', 'alt': ''});
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
					$("right-"+id+"-threaded").update();
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
					$("right-"+id+"-threaded").update();
					$("right-"+id+"-threaded").insert({'bottom': del_img_element});
				}
			}
			z_engine_tweet_right_click(id, "comment-"+id+"-threaded", author, userid, usermentions, faved, rtd, locked, type);
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
	if (entities.user_mentions.length > 0)
	{
		var mentioned = "";
		entities.user_mentions.uniq().each(function(item)
		{
			if (item.screen_name != screen_name)
			{
				var mention = "@"+item.screen_name+" ";
				mentioned += mention;
			}
		});
		if (mentioned.length > 0)
		{
			return $w(mentioned).uniq().join(" ")+" "; //every once in a while you will have a tweet where someone is mentioned twice - prevent that here
		}
		else
		{
			return "";
		}
	}
	else
	{
		return "";
	}
}

/* tweets are temporarily stored and will be displayed when you click unpause */
function z_engine_tweet_pause()
{
	if (!paused)
	{
		paused = true;
		$("pause").update("start");
		$("paused-count").appear();
	}
	else
	{
		paused = false;
		new Effect.Fade("paused-count",
		{
			afterFinish: function()
			{
				$("paused-count").update("(0)");
				$("pause").update("stop");
				pttid = 0;
			}
		});
	}
}

function z_engine_tweet_right_click(id, divid, author, userid, usermentions, faved, rtd, locked, type)
{
	if (author != screen_name)
	{
		rtd = false;
	}
	var context_menu = new Control.ContextMenu(divid,
	{
		animation: false
	});
	switch (type)
	{
		case 'home':
		case 'mentions':
		case 'threaded':
			if (author != screen_name)
			{
				context_menu.addItem(
				{
					label: 'reply',
					callback: function()
					{
						z_engine_reply(author, id, usermentions);
					}
				});
				if (!rtd)
				{
					if (!locked)
					{
						context_menu.addItem(
						{
							label: 'rt (new)',
							callback: function()
							{
								z_engine_retweet(id);
								context_menu.destroy();
							}
						});
						context_menu.addItem(
						{
							label: 'rt (old)',
							callback: function()
							{
								z_engine_retweet_comment(id, author, text);
								context_menu.destroy();
								z_engine_tweet_right_click(id, divid, author, userid, usermentions, faved, "comment", locked, type);
							}
						});
					}
				}
				else
				{
					if (rtd != "comment")
					{
						context_menu.addItem(
						{
							label: 'drop',
							callback: function()
							{
								z_engine_destroy(id, "rt");
								context_menu.destroy();
								z_engine_tweet_right_click(id, divid, author, userid, usermentions, faved, false, locked, type);
							}
						});
					}
				}
				if (!faved)
				{
					context_menu.addItem(
					{
						label: 'fave',
						callback: function()
						{
							z_engine_favorite(id);
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, userid, usermentions, true, rtd, locked, type);
						}
					});
				}
				else
				{
					context_menu.addItem(
					{
						label: 'unfave',
						callback: function()
						{
							z_engine_unfavorite(id);
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, userid, usermentions, false, rtd, locked, type);
						}
					});
				}
			}
			else
			{
				context_menu.addItem(
				{
					label: 'drop',
					callback: function()
					{
						z_engine_destroy(id, "tweet");
					}
				});
			}
		break;
		case 'dms':
			if (author != screen_name)
			{
				context_menu.addItem(
				{
					label: 'reply',
					callback: function()
					{
						z_engine_reply_dm(userid, author);
					}
				});
			}
			context_menu.addItem(
			{
				label: 'drop',
				callback: function()
				{
					z_engine_destroy(id, "dm");
				}
			});
		break;
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
	if ($$(elements).length > 0)
	{
		var time_elements = $$(elements);
		time_elements.each(function(item)
		{
			var this_stamp = item.getAttribute("datetime");
			item.update(relative_time(this_stamp));
		});
	}
}
