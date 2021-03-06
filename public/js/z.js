/* initial variables */
if (!store.get('client_blocks'))
{
	store.set('client_blocks', "");
}
var check_ratelimit_interval = 300; //check every 5 minutes
var content_faved_stored = Array();
var content_queued = Array(); //outputs our tweets nicely
var content_rts_stored = Array();
var content_stored = Array(); //stores all tweets
var current_tab = "home-timeline";
var dms_cutoff = 50; //max amount of tweets to display before pruning occurs on all dms
var following = Array(); //holds our following id's array
if (!store.get('geo'))
{
	store.set('geo', "off");
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
var home_cutoff = 100; //max amount of tweets to display before pruning occurs on the home timeline
if (!store.get('image_dropper'))
{
	store.set('image_dropper', "on");
}
if (!store.get('lang'))
{
	store.set('lang', "english");
}
var latest_threaded_id = 0;
var latitude = false; //hold our latitude
var loaded = false; //not loaded
var loaded2 = false; //hide the loading icon
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
var progress_bar = "";
var prune_tweets_interval = 60; //start the pruning loop over again every minute
var rates = 350;
var remember_cutoff = 199; //the maximum amount of names to store for autocompletion
var reply_id = false; //catch reply
if (!store.get('rt_type'))
{
	store.set('rt_type', "comment");
}
var screen_name = ""; //our own screen name
var scrollbar_home = "";
var scrollbar_inbox = "";
var scrollbar_mentions = "";
var scrollbar_outbox = "";
var scrollbar_threads = "";
var shortened = false;
var socket = "";
var socket_io_version_split = io.version.split(".");
var socket_io_version = socket_io_version_split[1]; //eg, returns a 6 or 7 so we can do sanity later on :)
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
		store.set('sound_src', "/audio/notify.ogg");  //and ogg for anyone else who supports the audio api
	}
}
if (store.get('sound') == "on" && store.get('sound_src').length > 0)
{
	if (window.HTMLAudioElement)
	{
		var audio = new Audio();
		audio.src = store.get('sound_src');
	}
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
var uploading = false;
var user_id = 0; //our own user id
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
		if (socket_io_version != "6")
		{
			socket = io.connectWithSession();
		}
		else
		{
			socket = new io.SessionSocket();
			socket.connect();
		}
		if (!loaded)
		{
			z_engine_get_language();
			new Event.observe("logout","click",function(event)
			{
				Event.stop(event);
				z_engine_logout();
			});
		}
		socket.on("connect",function()
		{
			if (!loaded)
			{
				$("new-tweet").setValue("connected...");
			}
		});
		socket.on("disconnect", function()
		{
			$("new-tweet").disable();
			$("new-tweet").setValue("...");
		});
		if (socket_io_version != "6")
		{
			socket.on("delete", function(json)
			{
				z_engine_handle_tweet_delete(json);
			});
			socket.on("direct_message", function(json)
			{
				z_engine_handle_tweet_dm(json);
			});
			socket.on("dms", function(json)
			{
				z_engine_handle_tweet_dms(json);
			});
			socket.on("event", function(json)
			{
				z_engine_handle_events(json);
			});
			socket.on("friends", function(json)
			{
				z_engine_handle_friends(json);
			});
			socket.on("home", function(json)
			{
				z_engine_handle_tweet_home(json);
			});
			socket.on("info", function(json)
			{
				z_engine_handle_info(json);
			});
			socket.on("loaded", function(json)
			{
				z_engine_handle_loaded(json);
			});
			socket.on("mentions", function(json)
			{
				z_engine_handle_tweet_mentions(json);
			});
			socket.on("rates", function(json)
			{
				z_engine_handle_rates(json);
			});
			socket.on("retweet_info", function(json)
			{
				z_engine_handle_retweet_info(json);
			});
			socket.on("server_error", function(json)
			{
				z_engine_handle_server_error(json);
			});
			socket.on("shorten", function(json)
			{
				z_engine_handle_shortened(json);
			});
			socket.on("show", function(json)
			{
				z_engine_handle_tweet_show(json);
			});
			socket.on("tweet", function(json)
			{
				z_engine_handle_tweet_data(json);
			});
		}
		else
		{
			socket.on("message", function(json)
			{
				var message = json.payload;
				var type = json.msg;
				switch (type)
				{
					case "delete":
						z_engine_handle_tweet_delete(message);
					break;
					case "direct_message":
						z_engine_handle_tweet_dm(message);
					break;
					case "dms":
						z_engine_handle_tweet_dms(message);
					break;
					case "event":
						z_engine_handle_events(message);
					break;
					case "friends":
						z_engine_handle_friends(message);
					break;
					case "home":
						z_engine_handle_tweet_home(message);
					break;
					case "info":
						z_engine_handle_info(message);
					break;
					case "loaded":
						z_engine_handle_loaded(message);
					break;
					case "mentions":
						z_engine_handle_tweet_mentions(message);
					break;
					case "rates":
						z_engine_handle_rates(message);
					break;
					case "retweet_info":
						z_engine_handle_retweet_info(message);
					break;
					case "server_error":
						z_engine_handle_server_error(message);
					break;
					case "shorten":
						z_engine_handle_shortened(message);
					break;
					case "show":
						z_engine_handle_tweet_show(message);
					break;
					case "tweet":
						z_engine_handle_tweet_data(message);
					break;
				}
			});
		}
	}
	else
	{
		$("new-tweet").setValue("sorry, your browser may not support this client!");
	}
}

/* clear the current timeline */
function z_engine_clear_timeline()
{
	new Effect.Fade(current_tab,
	{
		duration: 0.5,
		afterFinish: function()
		{
			$(current_tab).update().appear();
		}
	});
}

/* delete a tweet / dm */
function z_engine_destroy(id, method)
{
	var confirm_delete = confirm("\nare you sure you want to delete this?\n");
	if (confirm_delete)
	{
		switch (method)
		{
			case "dm":
				z_engine_handle_emitter("delete", {action: "dm", id_str: id});
				z_engine_drop_tweet(id);
			break;
			case "rt":
				content_rts_stored.each(function(item, index)
				{
					if (item.isJSON())
					{
						var data = item.evalJSON(true);
						var new_id = data.id_str;
						if (id == new_id)
						{
							var author = data.retweeted_status.screen_name;
							var author2 = data.screen_name;
							var entities = data.retweeted_status.entities;
							var faved = data.retweeted_status.favorited;
							id = data.retweeted_status.id_str; //reset the id to the original status
							var locked = data.retweeted_status.user["protected"];
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
								$("rt-"+id).writeAttribute("title", translation.retweet);
								$("rt-"+id).writeAttribute("src","/img/rt.png");
								$("rt-"+id).writeAttribute("onclick","z_engine_retweet('"+id+"');");
								z_engine_tweet_right_click(id, "rt-"+id, author, author2, userid, usermentions, text, faved, false, locked, "home");
							}
							if ($("rt-"+id+"-mentioned"))
							{
								$("rt-"+id+"-mentioned").writeAttribute("title", translation.retweet);
								$("rt-"+id+"-mentioned").writeAttribute("src","/img/rt.png");
								$("rt-"+id+"-mentioned").writeAttribute("onclick","z_engine_retweet('"+id+"');");
								z_engine_tweet_right_click(id, "rt-"+id+"-mentioned", author, author2, userid, usermentions, text, faved, false, locked, "mentions");
							}
							if ($("rt-"+id+"-threaded"))
							{
								$("rt-"+id+"-threaded").writeAttribute("title", translation.retweet);
								$("rt-"+id+"-threaded").writeAttribute("src","/img/rt.png");
								$("rt-"+id+"-threaded").writeAttribute("onclick","z_engine_retweet('"+id+"');");
								z_engine_tweet_right_click(id, "rt-"+id+"-threaded", author, author2, userid, usermentions, text, faved, false, locked, "threads");
							}
							z_engine_handle_emitter("delete", {action: "tweet", id_str: id});
							$break;
						}
					}
				});
			break;
			case "tweet":
				z_engine_handle_emitter("delete", {action: "tweet", id_str: id});
			break;
		}
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
		z_engine_fade_up("comment-"+id);
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
		z_engine_fade_up("comment-"+id+"-mentioned");
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
		z_engine_fade_up("comment-"+id+"-threaded");
	}
	z_engine_tweet_recalculate_layouts();
	z_engine_timeline_recalculate_layouts();
}

/* the fading + blind down animation */
function z_engine_fade_down(id)
{
	$(id).setStyle("display: none;");
	new Effect.Appear(id,
	{
		duration: 1,
		transition: Effect.Transitions.sinoidal
	});
}

/* the fading + blind up animation */
function z_engine_fade_up(id)
{
	new Effect.Fade(id,
	{
		duration: 1,
		transition: Effect.Transitions.sinoidal
	});
}

/* favorite a tweet */
function z_engine_favorite(id)
{
	id = z_engine_reset_id(id);
	z_engine_handle_emitter("favorite", {action: "do", id_str: id});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("title", translation.unfavorite);
		$("fave-"+id).writeAttribute("src","/img/favd.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("title", translation.unfavorite);
		$("fave-"+id+"-mentioned").writeAttribute("src","/img/favd.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
	if ($("fave-"+id+"-threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("title", translation.unfavorite);
		$("fave-"+id+"-threaded").writeAttribute("src","/img/favd.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
	}
}

/* just a quick callback to fetch resources */
function z_engine_fetch_timeline(timeline)
{
	z_engine_handle_emitter("fetch", timeline);
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
function z_engine_get_height(offset)
{
	var D = document;
	var height = Math.max(
		Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
		Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
		Math.max(D.body.clientHeight, D.documentElement.clientHeight)
	);
	if (offset != null | offset != 0)
	{
		height = height - offset;
	}
	return height;
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
					if (transport.responseText.isJSON())
					{
						translation = "";
						translation = transport.responseText.evalJSON(true);
						z_engine_set_language();
						z_engine_settings_set_language();
					}
				}
			});
		break;
		default:
			//do something else here?
		break;
	}
}

/* handle emitted (or rather, client to server) messages here */
function z_engine_handle_emitter(msg, payload)
{
	if (socket_io_version != "6")
	{
		socket.emit(msg, payload);
	}
	else
	{
		socket.send({msg: msg, payload: payload});
	}
}

/* handle all streamed events from twitter here */
function z_engine_handle_events(json)
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
				if (!content_faved_stored[json.target_object.id_str])
				{
					content_faved_stored[json.target_object.id_str] = 1;
				}
				else
				{
					content_faved_stored[json.target_object.id_str]++;
				}
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
			//todo: this
		break;
		case 'user_update':
		break;
		default:
			console.log(Object.toJSON(json.event)); //spit out the event name for quick reference...
			console.log(Object.toJSON(json)); //..then spit out the data itself so we can study it
		break;
	}
}

/* handle the friends event here */
function z_engine_handle_friends(json)
{
	var friends = json.join(" ");
	store.set('friends', friends);
}

/* handle info event here */
function z_engine_handle_info(json)
{
	screen_name = json.screen_name;
	user_id = json.user_id;
}

/* handle loaded event here */
function z_engine_handle_loaded(json)
{
	if (!loaded)
	{
		loaded = true;
		z_engine_settings_setup();
		z_engine_timers();
		z_engine_timeline_recalculate_layouts();
		z_engine_ui_components();
		z_engine_ui_events();
	}
	else
	{
		z_engine_fetch_timeline("userstream");
		$("new-tweet").clear();
		$("new-tweet").enable();
	}
}

/* handle rates here */
function z_engine_handle_rates(json)
{
	rates = json.remaining_hits;
	if (json.remaining_hits <= 10)
	{
		growler.growl("/img/dummy.png","notice!","you have "+json.remaining_hits+" (of "+json.hourly_limit+") request tokens left!");
	}
}

/* handle retweet info here */
function z_engine_handle_retweet_info(json)
{
	var id = json.retweeted_status.id_str;
	var this_id = json.id_str;
	content_rts_stored[id] = Object.toJSON(json);
	z_engine_unretweet(id, this_id);
}

/* handle server errors here */
function z_engine_handle_server_errors(json)
{
	switch (json.event)
	{
		case 'end':
			$("new-tweet").disable();
			growler.growl("/img/dummy.png", "notice!", "lost connection to the userstream, reconnecting...");
		break;
		case 'error':
			$("new-tweet").disable();
			growler.growl("/img/dummy.png", "notice!", "error occurred, reconnecting...");
		break;
	}
}

/* handle shortened urls here */
function z_engine_handle_shortened(json)
{
	if (typeof(json.shortened) == "undefined")
	{
	}
	else
	{
		$("new-tweet").setValue($("new-tweet").getValue().sub(json.original, json.shortened));
	}
}

/* handle the raw data before we do anything else here */
function z_engine_handle_tweet_data(json)
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
		content_queued.push(Object.toJSON(json));
		if (paused)
		{
			$("paused-count").update("("+content_queued.length+")");
		}
	}
}

/* handle the delete event here */
function z_engine_handle_tweet_delete(json)
{
	if (typeof(json.status) == "object")
	{
		var id = json.status.id_str;
		z_engine_drop_tweet(id);
	}
}

/* handle the raw dm data here */
function z_engine_handle_tweet_dm(json)
{
	z_engine_tweet(json, "dms top");
	if (json.sender.screen_name != screen_name)
	{
		var av = json.sender.profile_image_url;
		var text = json.text;
		var title = "@"+json.sender.screen_name+" sent a direct message";
		z_engine_notification(av, title, text);
	}
	else
	{
		var av = json.recipient.profile_image_url;
		var text = "sent a dm to @"+json.recipient.screen_name+"!";
		var title = json.text;
		z_engine_notification(av, title, text);
	}
}

/* handle both the inbox and outbox callback here */
function z_engine_handle_tweet_dms(json)
{
	z_engine_tweet(json, "dms bottom");
	if (!loaded2)
	{
		loaded2 = true;
		$("loading").fade();
	}
}

/* handle the home callback here */
function z_engine_handle_tweet_home(json)
{
	z_engine_tweet(json, "home bottom");
	if (!loaded2)
	{
		loaded2 = true;
		$("loading").fade();
	}
}

/* handle the mentions callback here */
function z_engine_handle_tweet_mentions(json)
{
	z_engine_tweet(json, "mentions bottom");
	if (!loaded2)
	{
		loaded2 = true;
		$("loading").fade();
	}
}

/* handle the show event here */
function z_engine_handle_tweet_show(json)
{
	if (!json.retweeted_status)
	{
		var id = json.id_str;
	}
	else
	{
		var id = json.retweeted_status.id_str;
	}
	content_stored[id] = Object.toJSON(json);
	z_engine_tweet(json, "threaded bottom");
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
			if (!uploading)
			{
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
								uploading = true;
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
										if (this.responseText.isJSON())
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
									}
									else
									{
										growler.growl("/img/dummy.png", "error!", "there seems to have been an error on imgur's end!");
										$("image").setStyle("border-color: red;");
										Element.setStyle.delay(2, "image", "border-color: #ddd;");
									}
									uploading = false;
								}
							}
							xhr.open("POST", "http://api.imgur.com/2/upload.json", true);
							xhr.send(form);
						break;
						default:
							growler.growl("/img/dummy.png", "error!", "this file is not supported, sorry!");
							$("image").setStyle("border-color: red;");
							Element.setStyle.delay(2, "image", "border-color: #ddd;");
						break;
					}
				}
			}
			else
			{
				growler.growl("/img/dummy.png", "error!", "wait until the current upload is finished!");
				$("image").setStyle("border-color: red;");
				Element.setStyle.delay(2, "image", "border-color: #ddd;");
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
		$("new-tweet").setStyle("color: #4d4d4d;");
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
}

function z_engine_input_resize()
{
	$("new-tweet").style.height = Math.floor($F($("new-tweet")).split('\n').inject(1, function(m, s)
	{
		return m += (s.length / ($("new-tweet").getHeight())) + 15;
	})) + "px";
}

/* properly log out a user */
function z_engine_logout()
{
	$("new-tweet").disable();
	$("new-tweet").setValue("see ya!");
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
		growler.growl(av, title, text.unescapeHTML());
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

/* get the original id for things we retweet */
function z_engine_reset_id(id)
{
	content_rts_stored.each(function(item, index)
	{
		if (item.isJSON())
		{
			var data = item.evalJSON(true);
			var new_id = data.id_str;
			if (id == new_id)
			{
				id = data.retweeted_status.id_str;
				$break;
			}
		}
	});
	return id;
}

/* retweet a tweet (official way) */
function z_engine_retweet(id)
{
	z_engine_handle_emitter("retweet", {id_str: id});
}

/* retweet a tweet (old way) */
function z_engine_retweet_comment(id, author, text)
{
	reply_id = id;
	switch (store.get('rt_type'))
	{
		case "comment":
			$("new-tweet").setValue("RT @"+author+": "+text.unescapeHTML());
		break;
		case "quote":
			$("new-tweet").setValue("\"@"+author+": "+text.unescapeHTML()+"\" ");
		break;
	}
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
		switch (current_tab)
		{
			case 'home-timeline-container':
			case 'mentions-timeline-container':
			case 'threaded-timeline-container':
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
			break;
			case 'dms-inbox-timeline-container':
			case 'dms-outbox-timeline-container':
				if (temp_user_element.length > 0)
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
			break;
		}
		z_engine_handle_emitter("status", send);
		reply_id = false;
		shortened = false;
		$("new-dm-user").enable();
		$("new-dm-user").clear();
		$("new-tweet").clear();
		$("new-tweet").enable();
		$("new-tweet").focus();
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
			case 'geo':
				if (store.get(storage) == "on")
				{
					var reset = "off";
				}
				else
				{
					var reset = "on";
				}
				store.set(storage, reset);
				if (store.get(storage) == "on")
				{
					z_engine_geo();
				}
				else
				{
					latitude = false;
					longitude = false;
				}
			break;
			case 'lang':
				store.set(storage, value);
				z_engine_get_language();
			break;
			case 'notifications_timeout':
				store.set(storage, value);
			break;
			case 'rt_type':
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
		case 'lang':
			$("language").childElements().each(function(item)
			{
				item.removeAttribute("selected");
			});
			$(store.get(storage)).writeAttribute("selected", "selected");
		break;
		case 'notifications_timeout':
			$(id).setValue(store.get(storage));
		break;
		case 'rt_type':
			$("retweet").childElements().each(function(item)
			{
				item.removeAttribute("selected");
			});
			$(store.get(storage)).writeAttribute("selected", "selected");
		break;
		case 'stream_interval':
			$(id).setValue(store.get(storage));
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
	$("retweet-settings").update(translation.retweet_settings);
	$("comment").update(translation.comment);
	$("quote").update(translation.quote);
	$("notify-settings").update(translation.notify_settings);
	$("notify-enable-settings").update(translation.notify_enable_settings);
	$("notify-audio-settings").update(translation.notify_audio_settings);
	$("notify-length-settings").update(translation.notify_length_settings);
	$("wait-length-settings").update(translation.wait_length_settings);
	$("other-settings").update(translation.other_settings);
	$("geo-settings").update(translation.geo_settings);
}

/* initialize all of your values on the settings page automatically */
function z_engine_settings_setup()
{
	z_engine_settings_get("language", "lang");
	z_engine_settings_checked_clicker("language", "lang");
	z_engine_settings_get("retweet", "rt_type");
	z_engine_settings_checked_clicker("retweet", "rt_type");
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
}

/* shorten urls */
function z_engine_shorten_urls()
{
	var current_tweet = $("new-tweet").getValue();
	if (current_tweet.length > 0 && !shortened)
	{
		current_tweet.scan(/((https?\:\/\/)|(www\.))([^ \(\)\{\}\[\]]+)/, function(url)
		{
			if (url[0].length >= 20) //the url needs to have some length to it, dont shorten anything that is already short
			{
				z_engine_handle_emitter("shorten", {shorten: url[0]});
			}
		});
		shortened = true;
		z_engine_input();
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

/* timers */
function z_engine_timers()
{
	z_engine_fetch_timeline("rates");
	z_engine_fetch_timeline("home");
	z_engine_fetch_timeline.delay(2, "userstream");
	z_engine_fetch_timeline.delay(15, "mentions");
	z_engine_fetch_timeline.delay(30, "dms-inbox");
	z_engine_fetch_timeline.delay(45, "dms-outbox");
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
		z_engine_fetch_timeline("rates");
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
}

/* the threaded engine */
function z_engine_threaded(init, id)
{
	if (init)
	{
		tabs.last();
		if (!content_stored[init])
		{
			z_engine_handle_emitter("show", {id_str: init});
		}
		else
		{
			if (content_stored[init].isJSON())
			{
				z_engine_tweet(content_stored[init].evalJSON(true), "threaded top");
			}
		}
	}
	else
	{
		if (!content_stored[id])
		{
			z_engine_handle_emitter("show", {id_str: id}); //continue the loop until nothing is left
		}
		else
		{
			if (content_stored[id].isJSON())
			{
				z_engine_tweet(content_stored[id].evalJSON(true), "threaded bottom");
			}
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
			if (BrowserDetect.browser == "Opera")
			{
				var date = data.created_at;
			}
			else
			{
				var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,'');
			}
			var date = data.created_at;
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
			if (BrowserDetect.browser == "Opera")
			{
				var date = data.retweeted_status.created_at;
			}
			else
			{
				var date = new Date(data.retweeted_status.created_at).toLocaleString().replace(/GMT.+/,'');
			}
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
		content_stored[id] = Object.toJSON(data);
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
					var gravatar_author_img_element = new Element('img', {'id': 'av-'+id, 'src': avatar, 'style': 'height: 50px; width: 50px;', 'alt': ''});
					gravatar_element.insert(gravatar_author_img_element);
				profile_wrapper_element.insert(gravatar_element);
			var comment_content_element = new Element('div', {'id': 'comment-'+id+'content', 'class': 'comment-content-wrapper right'});
			if (author != screen_name)
			{
				if (!mentioned)
				{
					var comment_body_element = new Element('div', {'class': 'comment-body', 'id': "comment-body-"+id}); //regular shadow
				}
				else
				{
					var comment_body_element = new Element('div', {'class': 'comment-body-mentioned', 'id': "comment-body-"+id}); //a noticeable red shadow
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
								var verified_img_element = new Element('img', {'src': '/img/ver.png', 'alt': '', 'title': 'verified user'});
								verified_element.insert({'bottom': verified_img_element});
								left_element.insert({'bottom': verified_element});
							}
						comment_date_element.insert(left_element);
						var right_element = new Element('div', {'class': 'right'});
							if (output != "dms" && place && place.full_name)
							{
								var place_element = new Element('span', {'class': 'place', 'id': 'place-'+id});
								var place_link_element = new Element('a', {'target': '_blank', href: 'http://maps.google.com?q='+place.full_name});
								var place_img_element = new Element('img', {'src': '/img/plc.png', 'alt': '', 'title': place.full_name});
								place_link_element.update(place_img_element);
								place_element.update(place_link_element);
								right_element.insert({'bottom': place_element});
							}
							if (rtd)
							{
								if (retweet_count > 0)
								{
									var rt_title = translation.retweeted_by+" "+author2+" + "+retweet_count+" "+translation.others+"!";
								}
								else
								{
									var rt_title = translation.retweeted_by+" "+author2+"!";
								}
								var rtd_element = new Element('span', {'class': 'rtd'});
								rtd_element.update(" ");
								var rtd_img_element = new Element('img', {'src': '/img/rtd2.png', 'alt': '', 'title': rt_title});
								var rtd_author_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+author2});
								rtd_author_link_element.update(author2);
								rtd_element.insert({'top': rtd_img_element});
								rtd_element.insert({'bottom': rtd_author_link_element});
								right_element.insert({'bottom': rtd_element});
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
							tweet_text.update(z_engine_parse_tweet(text.truncate(140)));
							comment_text_body_element.insert({'bottom': tweet_text});
						comment_text_element.insert(comment_text_body_element);
					comment_body_element.insert({'bottom': comment_text_element});
				comment_content_element.insert(comment_body_element);
			container_element.insert(profile_wrapper_element);
			container_element.insert({'bottom': comment_content_element});
			container_element.insert({'bottom': clearer_element});
		new Element.extend(comment_body_element);
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
			comment_body_element.writeAttribute("id", "comment-body-"+id+"-mentioned");
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
			z_engine_tweet_buttons("mentions", id, author, author2, userid, text, locked, faved, rtd, mentions_string);
			z_engine_fade_down("comment-"+id+"-mentioned");
			z_engine_notification(avatar, "@"+author+" mentioned you!", text);
		}
		if (output == "threaded")
		{
			comment_body_element.writeAttribute("id", "comment-body-"+id+"-threaded");
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
			z_engine_tweet_buttons("threaded", id, author, author2, userid, text, locked, faved, rtd, mentions_string);
			z_engine_fade_down("comment-"+id+"-threaded");
		}
		if ($("comment-"+id))
		{
			z_engine_tweet_buttons(output, id, author, author2, userid, text, locked, faved, rtd, mentions_string);
			z_engine_fade_down("comment-"+id);
		}
	}
	if (output == "threaded" && replyid)
	{
		z_engine_threaded(false, replyid);
	}
	z_engine_tweet_recalculate_layouts();
}

/* the reply / rt / fave / delete buttons */
function z_engine_tweet_buttons(type, id, author, author2, userid, text, locked, faved, rtd, usermentions)
{
	switch (type)
	{
		case 'dms':
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'onclick': 'z_engine_reply_dm("'+userid+'", "'+author+'");', 'src': '/img/rep.png', 'title': translation.reply, 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				$("right-"+id).insert(reply_img_element);
			}
			var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "dm");', 'src': '/img/del.png', 'title': translation.destroy, 'id': 'del-'+id, 'alt': ''});
			new Element.extend(del_img_element);
			$("right-"+id).insert({'bottom': del_img_element});
			z_engine_tweet_right_click(id, "comment-"+id, author, author2, userid, usermentions, text, faved, rtd, locked, type);
		break;
		case 'home':
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'title': translation.reply, 'id': 'reply-'+id, 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'title': translation.retweet, 'id': 'rt-'+id, 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': translation.favorite, 'id': 'fave-'+id, 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': translation.unfavorite, 'id': 'fave-'+id, 'alt': ''});
				}
				$("right-"+id).update();
				$("right-"+id).insert(reply_img_element);
				$("right-"+id).insert({'bottom': rt_img_element});
				$("right-"+id).insert({'bottom': fave_img_element});
			}
			else
			{
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'title': translation.destroy, 'src': '/img/del.png', 'id': 'del-'+id, 'alt': ''});
				new Element.extend(del_img_element);
				$("right-"+id).update();
				$("right-"+id).insert({'bottom': del_img_element});
			}
			z_engine_tweet_right_click(id, "comment-"+id, author, author2, userid, usermentions, text, faved, rtd, locked, type);
		break;
		case 'mentions':
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'-mentioned", "'+usermentions+'");', 'title': translation.reply, 'id': 'reply-'+id+'-mentioned', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'title': translation.retweet, 'id': 'rt-'+id+'-mentioned', 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': translation.favorite, 'id': 'fave-'+id+'-mentioned', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': translation.unfavorite, 'id': 'fave-'+id+'-mentioned', 'alt': ''});
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
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'title': translation.destroy, 'src': '/img/del.png', 'id': 'del-'+id+'-mentioned', 'alt': ''});
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
			if (author != screen_name)
			{
				var reply_img_element = new Element('img', {'src': '/img/rep.png', 'onclick': 'z_engine_reply("'+author+'", "'+id+'", "'+usermentions+'");', 'title': translation.reply, 'id': 'reply-'+id+'-threaded', 'alt': ''});
				new Element.extend(reply_img_element);
				if (!locked)
				{
					var rt_img_element = new Element('img', {'src': '/img/rt.png', 'onclick': 'z_engine_retweet("'+id+'");', 'id': 'rt-'+id+'-threaded', 'title': translation.retweet, 'alt': ''});
					new Element.extend(rt_img_element);
				}
				else
				{
					var rt_img_element = new Element('img', {'src': '/img/lock.png', 'style': 'cursor: default;', 'alt': ''});
				}
				if (!faved)
				{
					var fave_img_element = new Element('img', {'src': '/img/fav.png', 'onclick': 'z_engine_favorite("'+id+'");', 'title': translation.favorite, 'id': 'fave-'+id+'-threaded', 'alt': ''});
				}
				else
				{
					var fave_img_element = new Element('img', {'src': '/img/favd.png', 'onclick': 'z_engine_unfavorite("'+id+'");', 'title': translation.unfavorite, 'id': 'fave-'+id+'-threaded', 'alt': ''});
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
				var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "tweet");', 'src': '/img/del.png', 'title': translation.destroy, 'id': 'del-'+id+'-threaded', 'alt': ''});
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
			}
		});
	}
}

/* recalculate timeline sizes when the window is resized */
function z_engine_timeline_recalculate_layouts()
{
	$("home-timeline").setStyle("height: "+z_engine_get_height(120)+"px;");
	$("mentions-timeline").setStyle("height: "+z_engine_get_height(120)+"px;");
	$("dms-inbox-timeline").setStyle("height: "+z_engine_get_height(120)+"px;");
	$("dms-outbox-timeline").setStyle("height: "+z_engine_get_height(120)+"px;");
	$("threaded-timeline").setStyle("height: "+z_engine_get_height(120)+"px;");
}

/* recalculate the timeline sizes here */
function z_engine_tweet_recalculate_layouts()
{
	scrollbar_home.recalculateLayout();
	scrollbar_inbox.recalculateLayout();
	scrollbar_mentions.recalculateLayout();
	scrollbar_outbox.recalculateLayout();
	scrollbar_threads.recalculateLayout();
}

/* the neat context menu shown on tweets */
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
					label: '<img src="/img/rep.png" alt="" />',
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
							return '<img src="/img/rt.png" alt="" />';
						},
						condition: function()
						{
							return show_rt;
						},
						callback: function()
						{
							z_engine_retweet(id);
							context_menu.destroy();
							new PeriodicalExecuter(function(event)
							{
								if (content_rts_stored[id] && content_rts_stored[id].isJSON())
								{
									event.stop();
									var data = content_rts_stored[id].evalJSON(true);
									var new_id = data.id_str;
									z_engine_tweet_right_click(new_id, divid, author, screen_name, userid, usermentions, text, faved, true, locked, type);
								}
							}, 0.25);
						}
					});
					context_menu.addItem(
					{
						label: function()
						{
							return '<span>RT</span>';
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
							return '<img src="/img/rtd.png" alt="" />';
						},
						condition: function()
						{
							return undo_rt;
						},
						callback: function()
						{
							z_engine_destroy(id, 'rt');
							context_menu.close();
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, screen_name, userid, usermentions, text, faved, false, locked, type);
						}
					});
				}
				else
				{
					context_menu.addItem(
					{
						label: '<img src="/img/lock.png" alt="" />',
						enabled: false
					});
				}
				if (!faved)
				{
					context_menu.addItem(
					{
						label: '<img src="/img/fav.png" alt="" />',
						callback: function()
						{
							z_engine_favorite(id);
							context_menu.close();
							context_menu.destroy();
							z_engine_tweet_right_click(id, divid, author, author2, userid, usermentions, text, true, rtd, locked, type);
						}
					});
				}
				else
				{
					context_menu.addItem(
					{
						label: '<img src="/img/favd.png" alt="" />',
						callback: function()
						{
							z_engine_unfavorite(id);
							context_menu.close();
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
					label: '<img src="/img/del.png" alt="" />',
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
					return '<img src="/img/rep.png" alt="" />';
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
				label: '<img src="/img/del.png" alt="" />',
				callback: function()
				{
					z_engine_destroy(id, "dm");
				}
			});
		break;
	}
}

/* load the ui components here */
function z_engine_ui_components()
{
	$("new-tweet").clear();
	$("new-tweet").enable();
	if (store.get('geo') == "on")
	{
		z_engine_geo();
	}
	if (store.get("image_dropper") == "on")
	{
		z_engine_image_dropper();
	}
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
	scrollbar_home = new Control.ScrollBar("home-timeline", "home-timeline-scroll",
	{
		scroll_to_smoothing: 0.5
	});
	scrollbar_mentions = new Control.ScrollBar("mentions-timeline", "mentions-timeline-scroll",
	{
		scroll_to_smoothing: 0.5
	});
	scrollbar_inbox = new Control.ScrollBar("dms-inbox-timeline", "dms-inbox-timeline-scroll",
	{
		scroll_to_smoothing: 0.5
	});
	scrollbar_outbox = new Control.ScrollBar("dms-outbox-timeline", "dms-outbox-timeline-scroll",
	{
		scroll_to_smoothing: 0.5
	});
	scrollbar_threads = new Control.ScrollBar("threaded-timeline", "threaded-timeline-scroll",
	{
		scroll_to_smoothing: 0.5
	});
	tabs = new Control.Tabs('tabbed',
	{
		defaultTab: "first",
		afterChange: function(element)
		{
			current_tab = element.id;
			switch (element.id)
			{
				case "dms-inbox-timeline-container":
				case "dms-outbox-timeline-container":
					if ($("new-tweet").hasClassName("tweet"))
					{
						$("new-tweet").removeClassName("tweet");
					}
					if (!$("new-tweet").hasClassName("dm"))
					{
						$("new-tweet").addClassName("dm");
					}
					$("new-dm-user").appear();
				break;
				case "home-timeline-container":
				case "mentions-timeline-container":
				case "threaded-timeline-container":
					if ($("new-tweet").hasClassName("dm"))
					{
						$("new-tweet").removeClassName("dm");
					}
					if (!$("new-tweet").hasClassName("tweet"))
					{
						$("new-tweet").addClassName("tweet");
					}
					$("new-dm-user").fade().clear();
				break;
			}
			if (element.id != "threaded-timeline")
			{
				$("threaded-timeline").update();
				latest_threaded_id = 0;
			}
			z_engine_timeline_recalculate_layouts();
			z_engine_tweet_recalculate_layouts();
		}
	});
}

/* setup all events needed */
function z_engine_ui_events()
{
	new Event.observe("new-tweet","keyup",function(event)
	{
		z_engine_input();
		//z_engine_input_resize();
	});
	new Event.observe("new-tweet","keydown",function(event)
	{
		z_engine_input();
		//z_engine_input_resize();
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
	new Event.observe(window, "resize", function()
	{
		z_engine_tweet_recalculate_layouts();
		z_engine_timeline_recalculate_layouts();
	});
}

/* unfavorite a tweet */
function z_engine_unfavorite(id)
{
	id = z_engine_reset_id(id);
	z_engine_handle_emitter("favorite", {action: "undo", id_str: id});
	if ($("fave-"+id))
	{
		$("fave-"+id).writeAttribute("title", translation.favorite);
		$("fave-"+id).writeAttribute("src","/img/fav.png");
		$("fave-"+id).writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"-mentioned"))
	{
		$("fave-"+id+"-mentioned").writeAttribute("title", translation.favorite);
		$("fave-"+id+"-mentioned").writeAttribute("src","/img/fav.png");
		$("fave-"+id+"-mentioned").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
	if ($("fave-"+id+"-threaded"))
	{
		$("fave-"+id+"-threaded").writeAttribute("title", translation.favorite);
		$("fave-"+id+"-threaded").writeAttribute("src","/img/fav.png");
		$("fave-"+id+"-threaded").writeAttribute("onclick","z_engine_favorite('"+id+"');");
	}
}

/* undo a retweet */
function z_engine_unretweet(id, this_id)
{
	if ($("rt-"+id))
	{
		$("rt-"+id).writeAttribute("title", translation.unretweet);
		$("rt-"+id).writeAttribute("src","/img/rtd.png");
		$("rt-"+id).writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
	}
	if ($("rt-"+id+"-mentioned"))
	{
		$("rt-"+id+"-mentioned").writeAttribute("title", translation.unretweet);
		$("rt-"+id+"-mentioned").writeAttribute("src","/img/rtd.png");
		$("rt-"+id+"-mentioned").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
	}
	if ($("rt-"+id+"-threaded"))
	{
		$("rt-"+id+"-threaded").writeAttribute("title", translation.unretweet);
		$("rt-"+id+"-threaded").writeAttribute("src","/img/rtd.png");
		$("rt-"+id+"-threaded").writeAttribute("onclick","z_engine_destroy('"+this_id+"','rt');");
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
