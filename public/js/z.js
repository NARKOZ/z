/* initial variables */
if (!store.get('client_blocks'))
{
	store.set('client_blocks', "");
}
var check_ratelimit_interval = 300; //check every 5 minutes
var content_queued = Array(); //outputs our tweets nicely
var content_rts_stored = Array();
var content_stored = Array(); //stores all tweets
var dms_cutoff = 50; //max amount of tweets to display before pruning occurs on all dms
var dms_loaded = 0; //quick method to hide each dm timelines loading image without needing to write a ton of code to do it
var following = Array(); //holds our following id's array
if (!store.get('geo'))
{
	store.set('geo', "on");
}
if (store.get('geo') == "on")
{
	var geo_high_accuracy = false; //disable high accuracy on geo readings
	var geo_refresh_interval = 300; //refresh our geo
	var geo_timeout = 120; //give to two minutes to figure out where you are
}
if (!store.get('hashtag_blocks'))
{
	store.set('hashtag_blocks', "");
}
var home_cutoff = 200; //max amount of tweets to display before pruning occurs on the home timeline
if (!store.get('klout'))
{
	store.set('klout', "off");
}
var klout = Array(); //holds klout data
var kloutinfo_params = {
	className: 'klout',
	stem: true,
	target: true,
	targetJoint: ['left', 'top'],
	tipJoint: ['right', 'bottom']
}
if (!store.get('lang'))
{
	store.set('lang', "english");
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
if (!store.get('notifications'))
{
	store.set('notifications', "on");
}
if (!store.get('notifications_timeout'))
{
	store.set('notifications_timeout', 5);
}
var paused = false; //allow the engine itself to be momentarily 'paused'..not sure how im going to work this out properly
var previous_tab = "";
var progress_bar = "";
var prune_tweets_interval = 60; //start the pruning loop over again every minute
var pttid = 0; //this serves as the (#) amount displayed when paused
var rates = 350;
var remember_cutoff = 199; //the maximum amount of names to store for autocompletion
var reply_id = false; //catch reply
var screen_name = ""; //our own screen name
var shortened = false;
var socket = "";
var stream_queue_interval = "";
if (!store.get('sound'))
{
	store.set('sound', "on");
}
if (!store.get('sound-src'))
{
	if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Safari")
	{
		store.set('sound_src', "/audio/notify.mp3"); //use mp3 for ie and safari
	}
	else
	{
		store.set('sound_src', "/audio/notify.ogg");
	}
}
if (store.get('sound') == "on" && store.get('sound_src').length > 0)
{
	var audio = new Audio();
	audio.src = store.get('sound_src'); //and ogg for anyone else who supports the audio api
}
if (!store.get('stream_interval'))
{
	store.set('stream_interval', 1.5); //every one and a half seconds
}
var tabs = "";
var threaded_cutoff = 50; //max amount of tweets to display before pruning occurs on the threaded timeline
var translation = ""; //will hold our translation info
var update_relative_dms_interval = 60; //once a minute
var update_relative_home_interval = 15; //every 15 seconds
var update_relative_mentions_interval = 30; //every 30 seconds
var user_id = 0; //our own user id
var userinfo_params = {
	className: 'user',
	hideDelay: 3,
	hideOn: 'mouseout',
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

/* the websocket itself */
function z_engine_attrition()
{
	if (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Firefox" && BrowserDetect.version >= 3 || BrowserDetect.browser == "Chrome" || BrowserDetect.browser == "Opera" && BrowserDetect.version >= 9 || BrowserDetect.browser == "Safari")
	{
		socket = io.connectWithSession();
		if (!loaded)
		{
			z_engine_get_language();
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
			}
		});
		socket.on("delete", function(json)
		{
			if (typeof(json.status) == "object")
			{
				var id = json.status.id_str;
				z_engine_drop_tweet(id);
			}
		});
		socket.on("direct_message", function(json)
		{
			z_engine_tweet(json, "dms top");
			if (json.sender.screen_name != screen_name)
			{
				var av = json.sender.profile_image_url;
				var text = json.text;
				var title = "@"+json.sender.screen_name+" sent a direct message";
				z_engine_notification(av, title, text);
			}
		});
		socket.on("dms", function(json)
		{
			dms_loaded++;
			json.each(function(item)
			{
				z_engine_tweet(item, "dms bottom");
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
			rates--;
		});
		socket.on("event", function(json)
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
		});
		socket.on("friends", function(json)
		{
			var friends = json.join(" ");
			store.set('friends', friends);
		});
		socket.on("home", function(json)
		{
			json.each(function(item)
			{
				z_engine_tweet(item, "home bottom");
			});
			$("loading-home").fade();
			$("loading-mentions").appear();
			rates--;
			z_engine_fetch_timeline("userstream");
		});
		socket.on("info", function(json)
		{
			screen_name = json.screen_name;
			user_id = json.user_id;
			store.set('screen_name', json.screen_name);
			store.set('user_id', user_id);
		});
		socket.on("klout", function(json)
		{
			if (store.get('klout') == "on")
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
						$("klout-"+id).writeAttribute('onclick', '');
						$("klout-"+id).addTip('<big><strong>?</strong></big>', kloutinfo_params);
					}
				}
			}
		});
		socket.on("loaded", function(json)
		{
			loaded = true;
			$("new-tweet").setValue("");
			$("new-tweet").enable();
			z_engine_fetch_timeline("home");
			z_engine_check_ratelimit();
			z_engine_fetch_timeline("home");
			z_engine_fetch_timeline.delay(10, "mentions");
			z_engine_fetch_timeline.delay(20, "dms-inbox");
			z_engine_fetch_timeline.delay(30, "dms-outbox");
			new PeriodicalExecuter(function()
			{
				z_engine_update_relative_time("time.home");
			}, update_relative_home_interval);
			new PeriodicalExecuter(function()
			{
				z_engine_update_relative_time("time.mentions");
			}, update_relative_mentions_interval);
			new PeriodicalExecuter(function()
			{
				z_engine_update_relative_time("time.dms");
			}, update_relative_dms_interval);
			new PeriodicalExecuter(function()
			{
				z_engine_update_relative_time("time.threaded");
			}, update_relative_home_interval);
			new PeriodicalExecuter(function()
			{
				z_engine_check_ratelimit();
			}, check_ratelimit_interval);
			new PeriodicalExecuter(function()
			{
				if (!paused)
				{
					z_engine_prune_tweets();
				}
			}, prune_tweets_interval);
			stream_queue_interval = new PeriodicalExecuter(function()
			{
				if (!paused)
				{
					z_engine_stream_queue();
				}
			}, store.get('stream_interval'));
			if (store.get('geo') == "on")
			{
				new PeriodicalExecuter(function()
				{
					z_engine_geo();
				}, geo_refresh_interval);
			}
			new PeriodicalExecuter(function()
			{
				z_engine_input();
			}, 1);
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
			if (store.get('geo') == "on")
			{
				new HotKey('l',function(event)
				{
					z_engine_geo();
				},
				{
					shiftKey: true
				});
			}
			new HotKey('o',function(event)
			{
				z_engine_clear_timeline();
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
			progress_bar = new Control.ProgressBar('progress-bar');
			var settings_window = new Control.Modal($(document.body).down('[href=#settings-div]'),
			{
				className: 'window',
				closeOnClick: 'overlay',
				fade: true,
				overlayOpacity: 0.5
			});
			tabs = new Control.Tabs('tabbed',
			{
				beforechange: function()
				{
					previous_tab = z_engine_current_timeline();
				},
				afterChange: function()
				{
					var visible = z_engine_current_timeline();
					switch (visible)
					{
						case "dms-inbox-timeline":
						case "dms-outbox-timeline":
							$("new-dm-user").appear();
						break;
						default:
							$("new-tweet").removeClassName("dm");
							$("new-dm-user").fade().setValue("");
						break;
					}
					if (visible != "threaded-timeline")
					{
						$("threaded-timeline").update();
						latest_threaded_id = 0;
					}
				}
			});
			tabs.first();
			new Event.observe("new-tweet","keyup",function(event)
			{
				z_engine_input();
			});
			new Event.observe("new-tweet","keydown",function(event)
			{
				z_engine_input();
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
			if (store.get('geo') == "on")
			{
				z_engine_geo();
			}
			z_engine_image_dropper();
			z_engine_notification_setup();
			z_engine_settings_setup();
		});
		socket.on("mentions", function(json)
		{
			json.each(function(item)
			{
				z_engine_tweet(item, "mentions bottom");
			});
			$("loading-mentions").fade();
			$("loading-inbox").appear();
			rates--;
		});
		socket.on("rates", function(json)
		{
			rates = json.remaining_hits;
			if (json.remaining_hits <= 10)
			{
				z_engine_notification("","notice!","you have "+json.remaining_hits+" (of "+json.hourly_limit+") request tokens left!");
			}
		});
		socket.on("related", function(json) //very alpha material right here, it clones the sidebar in new twitter somewhat.
		{                                   //this was built mostly from looking at standard calls to api, as there are no
			try                             //official or unofficial docs on this method. hopefully it works for you too :)
			{                               //it is possible that you may need new twitter enabled for this to work right!
				var origin = false;
				json.data.each(function(item1)
				{
					if (item1.kind == "Tweet")
					{
						if (item1.value.retweeted_status)
						{
							var id = item1.value.retweeted_status.id_str;
						}
						else
						{
							var id = item1.value.id_str;
						}
						if (id == json.origin)
						{
							origin = true;
						}
						var role = item1.annotations.ConversationRole;
						switch (role)
						{
							case 'Ancestor':
								var position = "bottom";
							break;
							case 'Descendant':
								var position = "top";
							break;
							case 'Fork':
								var position = "top";
							break;
						}
						z_engine_tweet(item1.value, "threaded "+position);
					}
					else
					{
						item1.results.each(function(item2)
						{
							if (item2.kind == "Tweet")
							{
								if (item2.value.retweeted_status)
								{
									var id = item2.value.retweeted_status.id_str;
								}
								else
								{
									var id = item2.value.id_str;
								}
								if (id == json.origin)
								{
									origin = true;
								}
								var role = item2.annotations.ConversationRole;
								switch (role)
								{
									case 'Ancestor':
										var position = "bottom";
									break;
									case 'Descendant':
										var position = "top";
									break;
									case 'Fork':
										var position = "top";
									break;
								}
								z_engine_tweet(item2.value, "threaded "+position);
							}
						});
					}
				});
				if (content_stored[json.origin])
				{
					z_engine_tweet(content_stored[json.origin].evalJSON(true), "threaded top");
				}
			}
			catch(error)
			{
				console.log(error);
			}
			rates--;
		});
		socket.on("retweet_info", function(json)
		{
			var id = json.retweeted_status.id_str;
			var this_id = json.id_str;
			content_rts_stored[id] = JSON.stringify(json);
			if ($("rt-"+id))
			{
				$("rt-"+id).writeAttribute("title","undo retweet");
				$("rt-"+id).writeAttribute("src","img/rtd.png");
				$("rt-"+id).writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
			}
			if ($("rt-"+id+"-mentioned"))
			{
				$("rt-"+id+"-mentioned").writeAttribute("title","undo retweet");
				$("rt-"+id+"-mentioned").writeAttribute("src","img/rtd.png");
				$("rt-"+id+"-mentioned").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
			}
			if ($("rt-"+id+"-threaded"))
			{
				$("rt-"+id+"-threaded").writeAttribute("title","undo retweet");
				$("rt-"+id+"-threaded").writeAttribute("src","img/rtd.png");
				$("rt-"+id+"-threaded").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
			}
		});
		socket.on("server_error", function(json)
		{
			switch (json.event)
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
		});
		socket.on("shorten", function(json)
		{
			var current_tweet = $("new-tweet").getValue().replace(json.original, json.shorten);
			$("new-tweet").setValue(current_tweet);
		});
		socket.on("show", function(json)
		{
			if (!json.retweeted_status)
			{
				var id = json.id_str;
			}
			else
			{
				var id = json.retweeted_status.id_str;
			}
			content_stored[id] = JSON.stringify(json);
			z_engine_tweet(json, "threaded bottom");
			rates--;
		});
		socket.on("tweet", function(json)
		{
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
			else
			{
				content_queued.push(JSON.stringify(json));
				if (paused)
				{
					$("paused-count").update("("+pttid+")");
					pttid++;
				}
			}
		});
		socket.on("disconnect", function()
		{
			$("new-tweet").disable();
		});
	}
	else
	{
		$("new-tweet").setValue("sorry, your browser may not support this client!");
	}
}

/* check the ratelimits */
function z_engine_check_ratelimit()
{
	z_engine_fetch_timeline("rates");
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
		$(visible).update().appear().delay(0.5);
	}
}

/* determine which timeline is currently visible */
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
	else if ($("dms-inbox-timeline").visible())
	{
		return "dms-inbox-timeline";
	}
	if ($("dms-outbox-timeline").visible())
	{
		return "dms-outbox-timeline";
	}
	else if ($("threaded-timeline").visible())
	{
		return "threaded-timeline";
	}
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
			var params = {action: "tweet", id_str: id};
		}
		else if (method == "dm")
		{
			var params = {action: "dm", id_str: id};
			z_engine_drop_tweet(id);
		}
		if (method == "rt")
		{
			content_rts_stored.each(function(item, index)
			{
				var data = item.evalJSON(true);
				var new_id = data.id_str;
				if (id == new_id)
				{
					var author = data.retweeted_status.screen_name;
					var author2 = data.screen_name;
					var entities = data.retweeted_status.entities;
					var faved = data.retweeted_status.favorited;
					id = data.retweeted_status.id_str; //reset the idea to the original status
					var locked = data.retweeted_status.user["protected"];
					var params = {action: "tweet", id_str: id};
					var text = data.retweeted_status.text;
					var userid = data.retweeted_status.user.id;
					if (!entities)
					{
						var usermentions = false;
					}
					else
					{
						var usermentions = z_engine_tweet_mentioned_string(entities);
					}
					content_rts_stored.splice(index, 1); //see ya!
					if ($("rt-"+id))
					{
						$("rt-"+id).writeAttribute("title","retweet");
						$("rt-"+id).writeAttribute("src","img/rt.png");
						$("rt-"+id).writeAttribute("onclick","z_engine_retweet('"+id+"');");
						z_engine_tweet_right_click(id, "rt-"+id, author, author2, userid, usermentions, text, faved, false, locked, "home");
					}
					if ($("rt-"+id+"-mentioned"))
					{
						$("rt-"+id+"-mentioned").writeAttribute("title","retweet");
						$("rt-"+id+"-mentioned").writeAttribute("src","img/rt.png");
						$("rt-"+id+"-mentioned").writeAttribute("onclick","z_engine_retweet('"+id+"');");
						z_engine_tweet_right_click(id, "rt-"+id+"-mentioned", author, author2, userid, usermentions, text, faved, false, locked, "mentions");
					}
					if ($("rt-"+id+"-threaded"))
					{
						$("rt-"+id+"-threaded").writeAttribute("title","retweet");
						$("rt-"+id+"-threaded").writeAttribute("src","img/rt.png");
						$("rt-"+id+"-threaded").writeAttribute("onclick","z_engine_retweet('"+id+"');");
						z_engine_tweet_right_click(id, "rt-"+id+"-threaded", author, author2, userid, usermentions, text, faved, false, locked, "threads");
					}
					$break;
				}
			});
		}
		socket.emit("delete", params);
	}
}

/* drop tweet */
function z_engine_drop_tweet(id)
{
	if (content_stored[id])
	{
		var id_index = content_stored.indexOf(id);
		content_stored.splice(id_index, 1);
	}
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
		z_engine_fade_up.delay(3, "comment-"+id);
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
		z_engine_fade_up.delay(3, "comment-"+id+"-mentioned");
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
		z_engine_fade_up.delay(3, "comment-"+id+"-threaded");
	}
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
	socket.emit("favorite", {action: "do", id_str: id});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("title","unfavorite");
		$("fave-"+id).writeAttribute("src","img/favd.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("title","unfavorite");
		$("fave-"+id+"-mentioned").writeAttribute("src","img/favd.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("title","unfavorite");
		$("fave-"+id+"-threaded").writeAttribute("src","img/favd.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
}

function z_engine_fetch_timeline(timeline)
{
	socket.emit("fetch", timeline);
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
	else
	{
		if (google.loader.ClientLocation != null)
		{
			latitude = google.loader.ClientLocation.latitude;
			longitude = google.loader.ClientLocation.longitude;
		}
		else
		{
			latitude = false;
			longitude = false;
		}
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
			if (google.loader.ClientLocation != null)
			{
				latitude = google.loader.ClientLocation.latitude;
				longitude = google.loader.ClientLocation.longitude;
			}
			else
			{
				latitude = false;
				longitude = false;
			}
		break;
	}
}

/* set the geolocation vars */
function z_engine_geo_set(position)
{
	latitude = position.coords.latitude;
	longitude = position.coords.longitude;
}

/* get an accurate measurement of the _documents_ height (NOT the viewport) */
function z_engine_get_height()
{
	var D = document;
	return Math.max(
		Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
		Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
		Math.max(D.body.clientHeight, D.documentElement.clientHeight)
	);
}

/* get a users klout score */
function z_engine_get_klout(author, userid, id)
{
	if (!klout[userid])
	{
		socket.emit("klout", {klout: author, id_str: id});
	}
	else
	{
		var data = klout[userid].evalJSON(true);
		z_engine_set_klout(data, id);
	}
}

/* get the language */
function z_engine_get_language()
{
	var language = store.get('lang');
	switch (language)
	{
		case 'english':
		case 'russian':
			new Ajax.Request('/lang/'+language+'.json',
			{
				method: 'GET',
				onSuccess: function(transport)
				{
					translation = "";
					translation = transport.responseText.evalJSON(true);
					z_engine_set_language();
					z_engine_settings_set_language();
				}
			});
		break;
		default:
			//do something else here?
		break;
	}
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
						xhr.upload.onprogress = function(event)
						{
							if (event.lengthComputable)
							{
								var percent = (event.loaded / event.total) * 100;
								progress_bar.step(percent);
							}
						}
						xhr.onreadystatechange = function()
						{
							if (this.readyState == 1)
							{
								$("progress-bar").appear();
								$("image").setStyle("border-color: #ddd;"); //force it back
							}
							else if (this.readyState == 4)
							{
								$("progress-bar").fade();
								if (this.status == 200)
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
								}
								else
								{
									z_engine_notification("", "error!", "there seems to have been an error on imgur's end!");
									$("image").setStyle("border-color: red;");
									Element.setStyle.delay(2, "image", "border-color: #ddd;");
								}
							}
						}
						xhr.open("POST", "http://api.imgur.com/2/upload.json", true);
						xhr.send(form);
					break;
					default:
						z_engine_notification("", "error!", "this file is not supported, sorry!");
						$("image").setStyle("border-color: red;");
						Element.setStyle.delay(2, "image", "border-color: #ddd;");
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

/*  */
function z_engine_input()
{
	var tweet = $("new-tweet").getValue();
	var dm = $("new-dm-user").getValue();
	if (tweet.length == 0)
	{
		reply_id = false;
		shortened = false;
	}
	else if (tweet.length <= 140)
	{
		$("new-tweet").setStyle("color: #4d4d4d;");
	}
	else if (tweet.length >= 141)
	{
		z_engine_shorten_urls();
		$("new-tweet").setStyle("color: red;");
	}
	if (dm.length == 0)
	{
		$("new-tweet").removeClassName("dm");
	}
}

/* properly log out a user */
function z_engine_logout()
{
	socket.disconnect();
	$("new-tweet").disable();
	$("new-tweet").setValue("see ya!");
	store.remove('screen_name');
	store.remove('user_id');
	window.location = "/oauth/logout";
}

/* send a notification to the client */
function z_engine_notification(av, title, text)
{
	if (store.get('notifications') == "on")
	{
		if ((store.get('sound') == "on" && store.get('sound_src').length > 0) && (BrowserDetect.browser == "MSIE" && BrowserDetect.version >= 9 || BrowserDetect.browser != "MSIE"))
		{
			audio.play();
		}
		if (text == null)
		{
			text = "";
		}
		if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) //we can access webkit notifications
		{
			var notification = window.webkitNotifications.createNotification(av, title, text.unescapeHTML());
			notification.show();
			window.setTimeout(function()
			{
				notification.cancel();
			}, store.get('notifications_timeout') * 1000);
		}
		else if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1) //we might be able to access them if the user allows us to
		{
			window.webkitNotifications.requestPermission();
			growler.growl(av, title, text.unescapeHTML()); //send a growler notification anyway
		}
		else if (!window.webkitNotifications || window.webkitNotifications && window.webkitNotifications.checkPermission() == 2) //we cant access notifications
		{
			growler.growl(av, title, text.unescapeHTML());
		}
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
	var mention_elements = $("mentions-timeline").childElements();
	var dm_elements = $("dms-inbox-timeline").childElements();
	var dm_sent_elements = $("dms-outbox-timeline").childElements();
	var threaded_elements = $("threaded-timeline").childElements();
	if (tweet_elements.length >= home_cutoff)
	{
		tweet_elements.each(function(item, index)
		{
			if (index > home_cutoff)
			{
				var id = $(item).readAttribute("id").replace(/comment-/i,"");
				var id_index = content_stored.indexOf(id);
				content_stored.splice(id_index, 1);
				$(item).remove();
			}
		});
	}
	if (mention_elements.length >= mentions_cutoff)
	{
		mention_elements.each.delay(12, function(item, index)
		{
			if (index > mentions_cutoff)
			{
				var id = $(item).readAttribute("id").replace(/comment-/i,"");
				id = id.replace(/-mentioned/i,"");
				var id_index = content_stored.indexOf(id);
				content_stored.splice(id_index, 1);
				$(item).remove();
			}
		});
	}
	if (dm_elements.length >= dms_cutoff)
	{
		dm_elements.each.delay(24, function(item, index)
		{
			if (index > dms_cutoff)
			{
				var id = $(item).readAttribute("id").replace(/comment-/i,"");
				var id_index = content_stored.indexOf(id);
				content_stored.splice(id_index, 1);
				$(item).remove();
			}
		});
	}
	if (dm_sent_elements.length >= dms_cutoff)
	{
		dm_sent_elements.each.delay(36, function(item, index)
		{
			if (index > dms_cutoff)
			{
				var id = $(item).readAttribute("id").replace(/comment-/i,"");
				var id_index = content_stored.indexOf(id);
				content_stored.splice(id_index, 1);
				$(item).remove();
			}
		});
	}
	if (threaded_elements.length >= threaded_cutoff)
	{
		threaded_elements.each.delay(48, function(item, index)
		{
			if (index > threaded_cutoff)
			{
				var id = $(item).readAttribute("id").replace(/comment-/i,"");
				id = id.replace(/-mentioned/i,"");
				var id_index = content_stored.indexOf(id);
				content_stored.splice(id_index, 1);
				$(item).remove();
			}
		});
	}
}

/* related tweets */
function z_engine_related(id, replyid)
{
	tabs.last();
	socket.emit("related", {id_str: id, origin: replyid});
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
	$("new-tweet").addClassName("dm");
	$("new-tweet").focus();
}

/* retweet a tweet (official way) */
function z_engine_retweet(id)
{
	socket.emit("retweet", {id_str: id});
}

/* retweet a tweet (old way) */
function z_engine_retweet_comment(id, author, text)
{
	reply_id = id; //set this as a reply, it looks nicer
	$("new-tweet").setValue("RT @"+author+" "+text.unescapeHTML());
	$("new-tweet").focus();
}

/* send our tweet */
function z_engine_send_tweet()
{
	if ($("new-tweet").getValue().length > 0 && $("new-tweet").getValue().length <= 140)
	{
		$("new-tweet").disable();
		$("new-dm-user").disable();
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
				action: "dm",
				data: {
					screen_name: temp_user_element,
					text: temp_element
				}
			}
		}
		else
		{
			var send = {
				action: "tweet",
				data: {
					status: temp_element,
					include_entities: true
				}
			}
			if (store.get('geo') == "on" && latitude && longitude)
			{
				var geo = {
					display_coordinates: true,
					lat: latitude,
					'long': longitude
				}
				new Object.extend(send.data, geo);
			}
			if (reply_id)
			{
				var in_reply_to_status = {
					in_reply_to_status_id: reply_id
				}
				new Object.extend(send.data, in_reply_to_status);
			}
		}
		socket.emit("status", send);
		reply_id = false;
		shortened = false;
		$("new-dm-user").enable();
		$("new-dm-user").removeClassName("dm");
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
				$("klout-"+id).writeAttribute('src', 'img/kltd.png');
				$("klout-"+id).writeAttribute('title', '');
			}
			if ($("klout-"+id+"-mentioned"))
			{
				$("klout-"+id+"-mentioned").addTip(kloutinfo, kloutinfo_params);
				$("klout-"+id+"-mentioned").writeAttribute('src', 'img/kltd.png');
				$("klout-"+id+"-mentioned").writeAttribute('title', '');
			}
		}
	}
}

/* set up the language for the client */
function z_engine_set_language()
{
	$("home-timeline-click").update(translation.home);
	$("mentions-timeline-click").update(translation.mentions);
	$("dms-inbox-timeline-click").update(translation.inbox);
	$("dms-outbox-timeline-click").update(translation.outbox);
	$("pause").update(translation.stop);
	$("image").update(translation.image);
	$("settings").update(translation.settings);
	$("logout").update(translation.exit);
	$("new-dm-user").placeholder = translation.dm_to_placeholder;
	$("new-tweet").placeholder = translation.tweet_placeholder;
}

/* this watches for any changes to the inputs on the settings page */
function z_engine_settings_checked_clicker(id, storage)
{
	new Event.observe(id, 'change', function(event)
	{
		Event.stop(event);
		var value = $(id).getValue();
		switch (storage)
		{
			case 'lang':
				store.set(storage, value);
				z_engine_get_language();
			break;
			case 'notifications_timeout':
				store.set(storage, value);
			break;
			case 'stream_interval':
				store.set(storage, value);
				stream_queue_interval.stop();
				stream_queue_interval = new PeriodicalExecuter(function()
				{
					if (!paused)
					{
						z_engine_stream_queue();
					}
				}, value);
			break;
			default:
				if (store.get(storage) == "on")
				{
					var reset = "off";
				}
				else
				{
					var reset = "on";
				}
				store.set(storage, reset);
			break;
		}
	});
}

/* retreieve each of the stored values */
function z_engine_settings_get(id, storage)
{
	switch (storage)
	{
		case 'notifications_timeout':
			$(id).setValue(store.get(storage));
		break;
		case 'stream_interval':
			$(id).setValue(store.get(storage));
		break;
		case 'lang':
			var language = store.get("lang");
			$(language).writeAttribute("selected", "selected");
		break;
		default:
			if (store.get(storage) == "on")
			{
				$(id).click();
			}
		break;
	}
}

/* init language on the settings page */
function z_engine_settings_set_language()
{
	$("language-settings").update(translation.language_settings);
	$("notify-settings").update(translation.notify_settings);
	$("notify-enable-settings").update(translation.notify_enable_settings);
	$("notify-audio-settings").update(translation.notify_audio_settings);
	$("notify-length-settings").update(translation.notify_length_settings);
	$("wait-length-settings").update(translation.wait_length_settings);
	$("other-settings").update(translation.other_settings);
	$("geo-settings").update(translation.geo_settings);
	$("klout-settings").update(translation.klout_settings);
}

/* initialize all of your values on the settings page automatically */
function z_engine_settings_setup()
{
	z_engine_settings_get("language", "lang");
	z_engine_settings_checked_clicker("language", "lang");
	z_engine_settings_get("use-audio", "sound");
	z_engine_settings_checked_clicker("use-audio", "sound");
	z_engine_settings_get("use-notify", "notifications");
	z_engine_settings_checked_clicker("use-notify", "notifications");
	z_engine_settings_get("notify-length", "notifications_timeout");
	z_engine_settings_checked_clicker("notify-length", "notifications_timeout");
	z_engine_settings_get("stream-interval", "stream_interval");
	z_engine_settings_checked_clicker("stream-interval", "stream_interval");
	z_engine_settings_get("use-geo", "geo");
	z_engine_settings_checked_clicker("use-geo", "geo");
	z_engine_settings_get("use-klout", "klout");
	z_engine_settings_checked_clicker("use-klout", "klout");
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
				socket.emit("shorten", {shorten: url});
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
				z_engine_tweet(data, "home top");
			}
		}
	}
}

/* the threaded engine */
function z_engine_threaded(init, id)
{
	if (init)
	{
		tabs.last();
		if (!content_stored[init])
		{
			if (!content_stored[init])
			{
				socket.emit("show", {id_str: init});
			}
			else
			{
				z_engine_tweet(content_stored[init].evalJSON(true), "threaded top");
			}
		}
		else
		{
			z_engine_tweet(content_stored[init].evalJSON(true), "threaded top");
		}
	}
	else
	{
		if (!content_stored[id])
		{
			if (!content_stored[id])
			{
				socket.emit("show", {id_str: id}); //continue the loop until nothing is left
			}
			else
			{
				z_engine_tweet(content_stored[id].evalJSON(true), "threaded bottom");
			}
		}
		else
		{
			z_engine_tweet(content_stored[id].evalJSON(true), "threaded bottom");
		}
	}
}

/* the engine that handles, sorts, and displays our data */
function z_engine_tweet(data, divinfo)
{
	var split_div = $w(divinfo);
	var output = split_div[0];
	var position = split_div[1];
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
			var listed = data.user.listed_count;
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
			var listed = data.retweeted_status.user.listed_count;
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
		var listed = data.sender.listed_count;
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
		content_stored[id] = JSON.stringify(data);
		z_engine_remember_author(author);
		var userinfo = "";
		if (description != null && description != "")
		{
				userinfo += description+'<br /><br />';
		}
		if (location != null && location != "")
		{
			userinfo += 'location: <strong>'+location+'</strong><br />';
		}
		userinfo += 'tweets: <strong>'+tweets+'</strong><br />';
		userinfo += 'following: <strong>'+following+'</strong><br />';
		userinfo += 'followers: <strong>'+followers+'</strong><br />';
		userinfo += 'listed: <strong>'+listed+'</strong>';
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
							wrote_this_element.update(translation.wrote_this);
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
									in_reply_to_element.update(translation.in_reply_to);
									if (output == "threaded")
									{
										var in_reply_to_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+reply+'/status/'+replyid});
									}
									else
									{
										//var in_reply_to_link_element = new Element('span', {'onclick': 'z_engine_related("'+id+'","'+replyid+'");', 'style': 'cursor: pointer;'});
										var in_reply_to_link_element = new Element('span', {'onclick': 'z_engine_threaded("'+id+'","'+replyid+'");', 'style': 'cursor: pointer;'});
									}
									in_reply_to_link_element.update('@'+reply+' ');
									left_element.insert(in_reply_to_element);
									left_element.insert({'bottom': in_reply_to_link_element});
								}
								var via_source_element = new Element('span', {'class': 'via'});
								via_source_element.update(translation.via+' '+source);
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
								var place_element = new Element('span', {'class': 'place', 'id': 'place-'+id});
								var place_link_element = new Element('a', {'target': '_blank', href: 'http://maps.google.com?q='+place.full_name});
								var place_img_element = new Element('img', {'src': 'img/plc.png', 'alt': '', 'title': place.full_name});
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
							var tweet_text = new Element('div', {'id': "text-"+id, 'class': 'comment-text-select'});
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
		switch (position)
		{
			case 'bottom':
				var container_output = {'bottom': container_element}
			break;
			case 'top':
				var container_output = {'top': container_element}
			break;
		}
		switch (output)
		{
			case 'dms':
				if (author != screen_name)
				{
					$("dms-inbox-timeline").insert(container_output);
				}
				else if (author == screen_name)
				{
					$("dms-outbox-timeline").insert(container_output);
				}
			break;
			case 'home':
				$("home-timeline").insert(container_output);
			break;
			case 'mentions':
				$("mentions-timeline").insert(container_output);
			break;
		}
		if (mentioned && output != "mentions" && output != "threaded" && author != screen_name && !data.retweeted_status)
		{
			var mentioned_clone = cloneNodeWithEvents(container_element);
			mentioned_clone.writeAttribute("id", "comment-"+id+"-mentioned");
			left_element.writeAttribute("id", "left-"+id+"-mentioned");
			right2_element.writeAttribute("id", "right-"+id+"-mentioned");
			gravatar_author_img_element.writeAttribute("id", "av-"+id+"-mentioned");
			new Element.extend(mentioned_clone);
			switch (position)
			{
				case 'bottom':
					var mentioned_output = {'bottom': mentioned_clone}
				break;
				case 'top':
					var mentioned_output = {'top': mentioned_clone}
				break;
			}
			$("mentions-timeline").insert(mentioned_output);
			z_engine_tweet_buttons("mentions", id, author, author2, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id+"-mentioned");
			z_engine_notification(avatar, "@"+author+" mentioned you!", text);
		}
		if (output == "threaded")
		{
			left_element.writeAttribute("id", "left-"+id+"-threaded");
			right2_element.writeAttribute("id", "right-"+id+"-threaded");
			gravatar_author_img_element.writeAttribute("id", "av-"+id+"-threaded");
			var threaded_clone = cloneNodeWithEvents(container_element);
			threaded_clone.writeAttribute("id", "comment-"+id+"-threaded");
			new Element.extend(threaded_clone);
			switch (position)
			{
				case 'bottom':
					var threaded_output = {'bottom': threaded_clone}
				break;
				case 'top':
					var threaded_output = {'top': threaded_clone}
				break;
			}
			$("threaded-timeline").insert(threaded_output);
			z_engine_tweet_buttons("threaded", id, author, author2, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id+"-threaded");
		}
		if ($("comment-"+id))
		{
			z_engine_tweet_buttons(output, id, author, author2, userid, text, locked, faved, rtd, mentions_string, userinfo);
			z_engine_fade_down("comment-"+id);
		}
	}
	if (output == "threaded" && replyid)
	{
		z_engine_threaded(false, replyid);
	}
}

/* the reply / rt / fave / delete / klout buttons */
function z_engine_tweet_buttons(type, id, author, author2, userid, text, locked, faved, rtd, usermentions, userinfo)
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
				var reply_img_element = new Element('img', {'onclick': 'z_engine_reply_dm("'+userid+'", "'+author+'");', 'src': '/img/rep.png', 'title': 'reply', 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				$("right-"+id).insert(reply_img_element);
			}
			var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "dm");', 'src': '/img/del.png', 'title': 'delete', 'id': 'del-'+id, 'alt': ''});
			new Element.extend(del_img_element);
			$("right-"+id).insert({'bottom': del_img_element});
			z_engine_tweet_right_click(id, "comment-"+id, author, author2, userid, usermentions, text, faved, rtd, locked, type);
		break;
		case 'home':
			if ($("av-"+id))
			{
				$("av-"+id).addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if (store.get('klout') == "on")
			{
				if ($("left-"+id) && !$('klout-'+id))
				{
					var klout_element = new Element('span', {'class': 'klout'});
					klout_element.update(" ");
					var klout_img_element = new Element('img', {'onclick': 'z_engine_get_klout("'+author+'", "'+userid+'", "'+id+'");', 'src': '/img/klt.png', 'id': 'klout-'+id, 'alt': '', 'title': 'click to get this users klout score'});
					klout_element.insert({'top': klout_img_element});
					new Element.extend(klout_img_element);
					$("left-"+id).insert({'top': klout_element});
				}
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'title': 'reply', 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'title': 'retweet', 'id': 'rt-'+id, 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'title': 'this account is private', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': 'favorite', 'id': 'fave-'+id, 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': 'unfavorite', 'id': 'fave-'+id, 'alt': ''});
				}
				$("right-"+id).update();
				$("right-"+id).insert(reply_img_element);
				$("right-"+id).insert({'bottom': rt_img_element});
				$("right-"+id).insert({'bottom': fave_img_element});
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'title': 'delete', 'src': '/img/del.png', 'id': 'del-'+id, 'alt': ''});
				new Element.extend(del_img_element);
				$("right-"+id).update();
				$("right-"+id).insert({'bottom': del_img_element});
			}
			z_engine_tweet_right_click(id, "comment-"+id, author, author2, userid, usermentions, text, faved, rtd, locked, type);
		break;
		case 'mentions':
			if ($("av-"+id))
			{
				$("av-"+id).addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if ($("av-"+id+"-mentioned"))
			{
				$("av-"+id+"-mentioned").addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if ($("klout-"+id))
			{
				$("klout-"+id).remove();
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'-mentioned", "'+usermentions+'");', 'title': 'reply', 'id': 'reply-'+id+'-mentioned', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'title': 'retweet', 'id': 'rt-'+id+'-mentioned', 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'title': 'this account is private', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': 'favorite', 'id': 'fave-'+id+'-mentioned', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': 'unfavorite', 'id': 'fave-'+id+'-mentioned', 'alt': ''});
				}
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
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'title': 'delete', 'src': '/img/del.png', 'id': 'del-'+id+'-mentioned', 'alt': ''});
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
			if ($("comment-"+id))
			{
				z_engine_tweet_right_click(id, "comment-"+id, author, author2, userid, usermentions, text, faved, rtd, locked, type);
			}
			if ($("comment-"+id+"-mentioned"))
			{
				z_engine_tweet_right_click(id, "comment-"+id+"-mentioned", author, author2, userid, usermentions, text, faved, rtd, locked, type);
			}
		break;
		case 'threaded':
			if ($("av-"+id+"-threaded"))
			{
				$("av-"+id+"-threaded").addTip(z_engine_parse_tweet(userinfo), userinfo_params);
			}
			if ($("klout-"+id))
			{
				$("klout-"+id).remove();
			}
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'title': 'reply', 'id': 'reply-'+id+'-threaded', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'id': 'rt-'+id+'-threaded', 'title': 'retweet', 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'title': 'this account is private', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': 'favorite', 'id': 'fave-'+id+'-threaded', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': 'unfavorite', 'id': 'fave-'+id+'-threaded', 'alt': ''});
				}
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
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': '/img/del.png', 'title': 'delete', 'id': 'del-'+id+'-threaded', 'alt': ''});
				new Element.extend(del_img_element);
				if ($("right-"+id+"-threaded"))
				{
					$("right-"+id+"-threaded").update();
					$("right-"+id+"-threaded").insert({'bottom': del_img_element});
				}
			}
			z_engine_tweet_right_click(id, "comment-"+id+"-threaded", author, author2, userid, usermentions, text, faved, rtd, locked, type);
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
	if (entities && entities.user_mentions.length > 0)
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
		$("pause").update(translation.start);
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
				$("pause").update(translation.stop);
				pttid = 0;
			}
		});
	}
}

function z_engine_tweet_right_click(id, divid, author, author2, userid, usermentions, text, faved, rtd, locked, type)
{
	var is_me = false;
	var dm_reply_show = true;
	var show_rt = false;
	var undo_rt = false;
	if (author == screen_name)
	{
		is_me = true;
		dm_reply_show = false;
	}
	if (!rtd)
	{
		show_rt = true;
	}
	if (rtd && author2 != screen_name)
	{
		show_rt = true;
		rtd = false;
	}
	else if (rtd && author2 == screen_name)
	{
		undo_rt = true;
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
			if (!is_me)
			{
				context_menu.addItem(
				{
					label: '<img src="/img/rep.png" title="reply to all" alt="" />',
					callback: function()
					{
						z_engine_reply(author, id, usermentions);
					}
				});
				if (!locked)
				{
					context_menu.addItem(
					{
						label: function()
						{
							return '<img src="/img/rt.png" title="retweet" alt="" />';
						},
						condition: function()
						{
							return show_rt;
						},
						callback: function()
						{
							if (content_rts_stored[id])
							{
								var data = content_rts_stored[id].evalJSON(true);
								id = data.retweeted_status.id_str;
							}
							z_engine_retweet(id);
							new PeriodicalExecuter(function(event)
							{
								if (content_rts_stored[id])
								{
									event.stop();
									var data = content_rts_stored[id].evalJSON(true);
									var new_id = data.id_str;
									context_menu.destroy();
									z_engine_tweet_right_click(new_id, divid, author, screen_name, userid, usermentions, text, faved, true, locked, type);
								}
							}, 0.25);
						}
					});
					context_menu.addItem(
					{
						label: function()
						{
							return '<span title="retweet (with comment, old method)">RT</span>';
						},
						condition: function()
						{
							return show_rt;
						},
						callback: function()
						{
							z_engine_retweet_comment(id, author, text);
						}
					});
					context_menu.addItem(
					{
						label: function()
						{
							return '<img src="/img/rtd.png" title="undo retweet" alt="" />';
						},
						condition: function()
						{
							return undo_rt;
						},
						callback: function()
						{
							z_engine_destroy(id, 'rt');
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, screen_name, userid, usermentions, text, faved, false, locked, type);
						}
					});
				}
				else
				{
					context_menu.addItem(
					{
						label: '<img src="/img/lock.png" title="this account is private" alt="" />',
						enabled: false
					});
				}
				if (!faved)
				{
					context_menu.addItem(
					{
						label: '<img src="/img/fav.png" title="favorite" alt="" />',
						callback: function()
						{
							z_engine_favorite(id);
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, author2, userid, usermentions, text, true, rtd, locked, type);
						}
					});
				}
				else
				{
					context_menu.addItem(
					{
						label: '<img src="/img/favd.png" title="unfavorite" alt="" />',
						callback: function()
						{
							z_engine_unfavorite(id);
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, author2, userid, usermentions, text, false, rtd, locked, type);
						}
					});
				}
			}
			else
			{
				context_menu.addItem(
				{
					label: '<img src="/img/del.png" title="delete" alt="" />',
					callback: function()
					{
						z_engine_destroy(id, "tweet");
					}
				});
			}
		break;
		case 'dms':
			context_menu.addItem(
			{
				label: function()
				{
					return '<img src="/img/rep.png" title="reply" alt="" />';
				},
				condition: function()
				{
					return dm_reply_show;
				},
				callback: function()
				{
					z_engine_reply_dm(userid, author);
				}
			});
			context_menu.addItem(
			{
				label: '<img src="/img/del.png" title="delete" alt="" />',
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
	socket.emit("favorite", {action: "undo", id_str: id});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("title","favorite");
		$("fave-"+id).writeAttribute("src","img/fav.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"-mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("title","favorite");
		$("fave-"+id+"-mentioned").writeAttribute("src","img/fav.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"-threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("title","favorite");
		$("fave-"+id+"-threaded").writeAttribute("src","img/fav.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
}

/* update all time elements */
function z_engine_update_relative_time(elements)
{
	var time_elements = $$(elements);
	if (time_elements.length > 0)
	{
		time_elements.each(function(item)
		{
			var this_stamp = item.readAttribute("datetime");
			item.update(relative_time(this_stamp));
		});
	}
}
