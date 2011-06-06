/*
 * z engine stuff
 */

/* initial variables */
var content = Array(); //holds our tweets, allows us to prune it later / not display the same tweet more than twice
var content_paused = Array();
var cutoff = 200; //max amount of tweets to display before pruning occurs
var dm_to = false;
var following = Array(); //holds our following id's array
var ids = Array(); //work in progress to get the "just now" to update every 15 / 20 seconds
var paused = false; //allow the engine itself to be momentarily 'paused'..not sure how im going to work this out properly
var page = 1; //the page we start on (on the home timeline)
var pttid = 0;
var reply_id = false;
var screen_name = "";
var socket = new io.Socket(); //socket.io, duh
var tid = 0; //internal counter
var ts = 0;
var ttid = 0; //temporary internal counter
var user_id = 0;

/* the websocket itself */
function z_engine_attrition()
{
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1) //figured id go ahead and use this, why not?
	{
		window.webkitNotifications.requestPermission();
	}
	new Element.extend("new-tweet-form");
	new Element.extend("home-timeline");
	new Event.observe("clear","click",function(event)
	{
		Event.stop(event);
		return z_engine_tweet_clear();
	});
	new Event.observe("pause","click",function(event)
	{
		Event.stop(event);
		return z_engine_tweet_pause();
	});
	if($("new-tweet").getValue() === '')
	{
		new Event.observe("new-tweet","keyup",function(event)
		{
			dm_to = false; //need to do this another way...if you clear the input you need to hit reply again for now
			reply_id = false;
		});
		new Event.observe("new-tweet","keydown",function(event)
		{
			//because we autofocus into a blank input, this would break dms if we reset dm_to = false here
			reply_id = false;
		});
	}
	socket.connect();
	socket.on("connect",function()
	{
		$("new-tweet").setValue("connected...");
	});
	socket.on("message", function(json)
	{
		if (json.loaded)
		{
			$("new-tweet").setValue("");
			$("new-tweet").enable();
			$("new-tweet-submit").enable();
			$("loading").fade();
			new Event.observe("new-tweet-form", "submit", function(event)
			{
				Event.stop(event);
				z_engine_send_tweet();
			});
			z_engine_clicker("home-timeline-click", "home-timeline"); //home
			z_engine_clicker("mentions-timeline-click", "mentions-timeline"); //mentions
			z_engine_clicker("dms-timeline-click", "dms-timeline"); //dms
			z_engine_dms_clicker("dms-inbox-timeline-click", "dms-inbox-timeline");
			z_engine_dms_clicker("dms-outbox-timeline-click", "dms-outbox-timeline");
			socket.send({fetch: "home"});
			var populate_mentions_tab = window.setTimeout(function()
			{
				socket.send({fetch: "mentions"});
			},10000);
			var populate_dms_inbox_tab = window.setTimeout(function()
			{
				socket.send({fetch: "dms-inbox"});
			},15000);
			var populate_dms_outbox_tab = window.setTimeout(function()
			{
				socket.send({fetch: "dms-outbox"});
			},20000);
			var update_relative_time = window.setInterval(function()
			{
				this.z_engine_update_relative_time()
			},15000);
			var prune_old_tweets = window.setInterval(function()
			{
				z_engine_clean_tweets();
			},30000);
		}
		else if (json.delete)
		{
			var id = json.delete.status.id;
			if (json.delete.status.id_str)
			{
				id = json.delete.status.id_str;
			}
			if ($("comment-"+id))
			{
				$("comment-"+id).setStyle("text-decoration: line-through;");
				window.setTimeout(function()
				{
					new S2.FX.Parallel(
					[
						new Effect.BlindUp("comment-"+id,
						{
							duration: 1.25,
							mode: 'relative'
						}),
						new Effect.Fade("comment-"+id,
						{
							duration: 1,
							mode: 'relative'
						}),
					],
					{
						duration: 1.25
					});
				},5000);
			}
		}
		else if (json.direct_message)
		{
			z_engine_tweet(json.direct_message, "dms");
			if (json.direct_message.sender.screen_name != screen_name)
			{
				z_engine_notification(json.direct_message.sender.profile_image_url, json.direct_message.sender.screen_name+" sent a direct message", json.direct_message.text);
			}
		}
		else if (json.dms)
		{
			for (i = 0; i < json.dms.length; i++)
			{
				z_engine_tweet(json.dms[i], "dms");
			}
		}
		else if (json.event)
		{
			var data = json.event;
			if (data.favorite && data.source.user.screen_name != screen_name)
			{
				z_engine_notification(data.source.user.profile_image_url, data.source.user.screen_name+" favorited your tweet!", data.target_object.text);
			}
			else if (data.follow && data.source.screen_name != screen_name)
			{
				z_engine_notification(data.source.profile_image_url, data.source.screen_name+" started following you!", data.source.description);
			}
			else if (data.list_member_added && json.source.screen_name != screen_name)
			{
				z_engine_notification(json.source.profile_image_url, json.source.screen_name+" put you in "+json.target_object.full_name, json.target_object.description);
			}
			else
			{
				console.log(JSON.stringify(json.event));
			}
		}
		else if (json.friends)
		{
			following = JSON.stringify(json.friends);
		}
		else if (json.info)
		{
			screen_name = json.info.screen_name;
			user_id = json.info.user_id;
			Cookie.init({name: 'info', expires: 365});
			Cookie.setData(JSON.stringify(json.info), false);
		}
		else if (json.mentions)
		{
			for (i = 0; i < json.mentions.length; i++)
			{
				z_engine_tweet(json.mentions[i], "mentions");
			}
		}
		else if (json.retweet_info)
		{
			var data = json.retweet_info;
			if ($("comment-"+data.retweeted_status.id_str))
			{
				$("rt-"+data.retweeted_status.id_str).writeAttribute("src","img/rtd.png");
				$("rt-"+data.retweeted_status.id_str).writeAttribute("onclick","z_engine_destroy('"+data.retweeted_status.id_str+"','rt');");
			}
		}
		else if (json.text && json.user && json.created_at) //ensure we are about to do this to a valid tweet
		{
			if (!paused)
			{
				z_engine_tweet(json, "home");
			}
			else
			{
				z_engine_tweet_pause_handler(json);
			}
		}
	});
	socket.on('disconnect', function()
	{
		$("new-tweet").disable();
		$("new-tweet-submit").disable();
		$("new-tweet").setValue("lost connection!");
	});
}

/* the "home", "mentions", "mentions", etc switcher */
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
						duration: 0.25,
						mode: 'relative'
					}),
					new Effect.Fade("dms-inbox-timeline-click",
					{
						duration: 0.25,
						mode: 'relative'
					}),
					new Effect.Appear("dms-timeline-click",
					{
						delay: 0.25,
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
			else if ($("mentions-timeline").visible())
			{
				var hide = "mentions-timeline";
			}
			else if ($("dms-timeline").visible())
			{
				var hide = "dms-timeline";
			}
			new S2.FX.Parallel(
			[
				new Effect.Fade(hide,
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.BlindUp(hide,
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.BlindDown(this_id,
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.Appear(this_id,
				{
					duration: 0.25,
					mode: 'relative'
				})
			],
			{
				duration: 0.5
			});
		}
	});
}

/* a more specific clicker for the inbox / outbox page */
function z_engine_dms_clicker(id, this_id)
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
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.BlindUp(hide,
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.BlindDown(this_id,
				{
					duration: 0.25,
					mode: 'relative'
				}),
				new Effect.Appear(this_id,
				{
					duration: 0.25,
					mode: 'relative'
				})
			],
			{
				duration: 1
			});
		}
	});
}

/* hopefully this will hopefully trim older tweets later on (when you get around 50 or so logged up) */
function z_engine_clean_tweets()
{
	var tweet_elements = $("home-timeline").childElements();
	if (tweet_elements.length > 0)
	{
		for (i = 0; i < tweet_elements.length; i++)
		{
			if (i > cutoff)
			{
				$(tweet_elements[i]).remove();
			}
		}
	}
	window.setTimeout(function()
	{
		var mention_elements = $("mentions-timeline").childElements();
		if (mention_elements.length > 0)
		{
			for (i = 0; i < mention_elements.length; i++)
			{
				if (i > cutoff)
				{
					$(mention_elements[i]).remove();
				}
			}
		}
	},10000);
	window.setTimeout(function()
	{
		var dm_elements = $("dms-inbox-timeline").childElements();
		if (dm_elements.length > 0)
		{
			for (i = 0; i < dm_elements.length; i++)
			{
				if (i > cutoff)
				{
					$(dm_elements[i]).remove();
				}
			}
		}
	},20000);
	window.setTimeout(function()
	{
		var dm_sent_elements = $("dms-outbox-timeline").childElements();
		if (dm_sent_elements.length > 0)
		{
			for (i = 0; i < dm_sent_elements.length; i++)
			{
				if (i > cutoff)
				{
					$(dm_sent_elements[i]).remove();
				}
			}
		}
	},30000);
}

/* delete a tweet / dm */
function z_engine_destroy(id, method)
{
	var confirm_delete = confirm("\nAre you sure you want to delete this?\n");
	if (confirm_delete)
	{
		if (method == "tweet" || method == "rt")
		{
			var params = {destroy: {status: {id_str: id}}};
		}
		else if (method == "dm")
		{
			var params = {destroy_dm: {status: {id_str: id}}};
		}
		if (method == "rt")
		{
			$("rt-"+id).setAttribute("src","img/rt.png");
			$("tr-"+id).setAttribute("onclick","z_engine_retweet('"+id+"');");
		}
		socket.send(params);
	}
}

/* favorite a tweet */
function z_engine_favorite(id)
{
	socket.send({favorite: {status: {id_str: id}}});
	$("fave-"+id).writeAttribute("src","img/favd.png");
	$("fave-"+id).writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
}

/* starts up the engine */
function z_engine_kickstart()
{
	if (window.addEventListener)
	{
		window.addEventListener("load",z_engine_attrition(),false);
	}
	else
	{
		window.attachEvent("onload",z_engine_attrition());
	}
}

/* send a notification to the client */
function z_engine_notification(av, head, text)
{
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0)
	{
		var notification = window.webkitNotifications.createNotification(av, head, text);
		notification.show();
		window.setTimeout(function()
		{

			notification.cancel();
		},5500);
	}
	else if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 1)
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
		text = twttr.txt.autoLink(text, {extraHtml: 'target="_blank"', hashtagUrlBase: 'https://search.twitter.com/search?q=%23'});
		text = text.replace(/\n\r?/g, '<br />');
		return text;
	}
}

/* reply to a specific tweet */
function z_engine_reply(id, author)
{
	reply_id = id;
	$("new-tweet").setValue("@"+author+" ");
	$("new-tweet").focus();
}

/* reply to a dm */
function z_engine_reply_dm(userid)
{
	dm_to = userid;
	$("new-tweet").setValue("");
	$("new-tweet").focus();
}

/* retweet a tweet */
function z_engine_retweet(id)
{
	var confirm_rt = confirm("\nAre you sure you want to retweet this?\n");
	if (confirm_rt)
	{
		socket.send({retweet: {status: {id_str: id}}});
	}
}

/* send our tweet */
function z_engine_send_tweet()
{
	if ($("new-tweet").getValue().length > 0)
	{
		$("new-tweet").disable();
		$("new-tweet-submit").disable();
		var temp_element = $("new-tweet").getValue();
		if (!reply_id && !dm_to)
		{
			var send = {
				status: {
					status: temp_element,
					include_entities: true
				}
			};
		}
		else
		{
			if (reply_id != false)
			{
				var send = {
					status: {
						status: temp_element,
						in_reply_to_status_id: reply_id,
						include_entities: true
					}
				};
			}
			else if (dm_to != false)
			{
				var send = {
					direct_message: {
						text: temp_element,
						user_id: dm_to
					}
				};
			}
		}
		socket.send(send);
		reply_id = false;
		dm_to = false;
		$("new-tweet").setValue("");
		$("new-tweet").enable();
		$("new-tweet-submit").enable();
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
			var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,''); //fix some "blank dates"
			var entities = data.entities;
			var faved = data.favorited;
			if (output != "dms")
			{
				var id = data.id_str;
			}
			else
			{
				var id = data.id;
			}
			var locked = data.user.protected;
			var name = data.user.name;
			var reply = data.in_reply_to_screen_name;
			var replyid = data.in_reply_to_status_id_str;
			var rtd = false;
			var source = data.source;
			var text = data.text;
			var userid = data.user.id;
			var verified = data.user.verified;
		}
		else
		{
			var author = data.retweeted_status.user.screen_name;
			var author2 = data.user.screen_name;
			var avatar = data.retweeted_status.user.profile_image_url;
			var avatar2 = data.user.profile_image_url;
			var date = new Date(data.retweeted_status.created_at).toLocaleString().replace(/GMT.+/,''); //fix some "blank dates"
			var entities = data.retweeted_status.entities;
			var faved = data.retweeted_status.favorited;
			if (output != "dms")
			{
				var id = data.retweeted_status.id_str;
			}
			else
			{
				var id = data.retweeted_status.id;
			}
			var locked = data.retweeted_status.user.protected;
			var name = data.retweeted_status.user.name;
			var reply = data.retweeted_status.in_reply_to_screen_name;
			var replyid = data.retweeted_status.in_reply_to_status_id_str;
			var rtd = true;
			var source = data.retweeted_status.source;
			var text = data.retweeted_status.text;
			var userid = data.retweeted_status.user.id;
			var verified = data.retweeted_status.user.verified;
		}
	}
	else
	{
			var author = data.sender.screen_name;
			var avatar = data.sender.profile_image_url;
			var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,''); //fix some "blank dates"
			var id = data.id_str;
			var locked = data.sender.protected;
			var name = data.sender.name;
			var reply = data.in_reply_to_screen_name;
			var rtd = false;
			var text = data.text;
			var userid = data.sender_id;
			var verified = data.sender.verified;
	}
	if (!content[id]) //this probably looks funny at first but it is very important because it delimits every tweet by its id
	{                 //the reason being is because retweet data works in _literal_ manner via the streaming api
		if (output != "mentions")
		{
			ids[tid] = id;
			content[id] = true; //see comment above
		}
		var linebreak = new Element('br');
		if (!entities) //theres been a few instances of entities not being included, and thus this
		{
			var mentioned = false;
		}
		else
		{
			var mentioned = z_engine_tweet_mentioned(entities);
		}
		var container_element = new Element('li', {'id': 'comment-'+id, 'class': 'comment-parent', 'style': 'display:none;opacity:0;'});
			var profile_wrapper_element = new Element('div', {'class': 'comment-profile-wrapper left'});
				var gravatar_element = new Element('div', {'class': 'comment-gravatar'});
					var gravatar_author_link_element = new Element('a', {'target': '_blank', href: 'http://twitter.com/'+author});
						var gravatar_author_img_element = new Element('img', {'src': avatar, 'style': 'height:50px;width:50px', 'alt': ''});
						gravatar_author_link_element.insert(gravatar_author_img_element);
					gravatar_element.insert(gravatar_author_link_element);
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
						var left_element = new Element('div', {'class': 'left'});
							var author_link_element = new Element('a', {'target': '_blank', href: 'http://twitter.com/'+author});
							author_link_element.update('@'+author+' ');
							var wrote_this_element = new Element('span');
							wrote_this_element.update('wrote this ');
							if (output != "dms")
							{
								var status_link_element = new Element('a', {'target': '_blank', 'id': 'comment-'+id+'-relative-date', href: 'http://twitter.com/'+author+'/status/'+id});
							}
							var status_time_element = new Element('time', {'datetime': date});
							status_time_element.update(relative_time(date));
							if (output != "dms")
							{
								status_link_element.insert(status_time_element);
							}
							if (output != "dms")
							{
								var via_source_element = new Element('span');
								via_source_element.update(' via '+source);
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
									var in_reply_to_link_element = new Element('a', {'target': '_blank', 'href': 'http://twitter.com/'+reply+'/status/'+replyid});
									in_reply_to_link_element.update(reply+' ');
									left_element.insert(in_reply_to_element);
									left_element.insert({'bottom': in_reply_to_link_element});
								}
								left_element.insert({'bottom': via_source_element});
							}
							else
							{
								left_element.insert({'bottom':status_time_element});
							}
						comment_date_element.insert(left_element);
						var right_element = new Element('div', {'class': 'right'});
							if (rtd)
							{
								var rtd_element = new Element('span');
								rtd_element.update('RT\'d by <a target="_blank" href="http://twitter.com/'+author2+'">'+author2+'</a>');
								right_element.insert(rtd_element);
							}
						comment_date_element.insert({'bottom': right_element});
					comment_body_element.insert({'bottom': comment_date_element});
					var clearer_element = new Element('div', {'class': 'clearer'});
						clearer_element.update("&nbsp;");
					comment_body_element.insert({'bottom': clearer_element});
					var comment_text_element = new Element('div', {'class': 'comment-text'});
						var comment_text_body_element = new Element('p', {'id': 'comment-'+id+'-text'});
							var right2_element = new Element('div', {'class': 'right'});
							if (author != screen_name && output != "dms")
							{
								var reply_img_element = new Element('img', {'src': 'img/rep.png', 'onclick': 'z_engine_reply("'+id+'", "'+author+'");', 'id': 'reply-'+id, 'alt': ''});
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
								new Element.extend(reply_img_element);
								new Element.extend(fave_img_element);
								right2_element.insert(reply_img_element);
								right2_element.insert({'bottom': rt_img_element});
								right2_element.insert({'bottom': fave_img_element});
							}
							else
							{
								if (author != screen_name)
								{
									var reply_img_element = new Element('img', {'onclick': 'z_engine_reply_dm("'+userid+'");', 'src': 'img/rep.png', 'id': 'reply-'+id, 'alt': ''});
									right2_element.insert(reply_img_element);
									new Element.extend(reply_img_element);
								}
								var del_img_element = new Element('img', {'onclick': 'z_engine_destroy("'+id+'", "dm");', 'src': 'img/del.png', 'id': 'del-'+id, 'alt': ''});
								right2_element.insert({'bottom': del_img_element});
								new Element.extend(del_img_element);
							}
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
			case 'mentions':
				$("mentions-timeline").insert({'top': container_element});
			break;
			case 'home':
				$("home-timeline").insert({'top': container_element});
			break;
		}
		new S2.FX.Parallel(
		[
			new Effect.Appear('comment-'+id,
			{
				duration: 1.25,
				mode: 'relative'
			}),
			new Effect.BlindDown('comment-'+id,
			{
				duration: 0.7,
				mode: 'relative'
			})
		],
		{
			duration: 1.5
		});
		if (mentioned && output != "mentions")
		{
			if (mentioned)
			{
				z_engine_notification(avatar, author, text);
				var mentioned_clone = cloneNodeWithEvents(container_element);
				//var mentioned_clone = $(container_element.cloneNode(true));
				mentioned_clone.setAttribute("id", "comment-"+id+"-mentioned");
				new Element.extend(mentioned_clone);
				$("mentions-timeline").insert({'top': mentioned_clone});
			}
			new S2.FX.Parallel(
			[
				new Effect.Appear('comment-'+id+'-mentioned',
				{
					duration: 1.25,
					mode: 'relative'
				}),
				new Effect.BlindDown('comment-'+id+'-mentioned',
				{
					duration: 0.7,
					mode: 'relative'
				})
			],
			{
				duration: 1.5
			});
		}
	}
	else
	{
		if (author == screen_name && author2 != screen_name)
		{
			z_engine_notification(avatar2, author2+" retweeted you!", text);
		}
	}
	if (!mentioned)
	{
		tid++;
	}
}

/* clear everything out (view & content var wise) */
function z_engine_tweet_clear()
{
	$("home-timeline").update();
	$("mentions-timeline").update();
	$("dms-inbox-timeline").update();
	$("dms-outbox-timeline").update();
}

/* see if we were mentioned, this is faster than parsing through the text itself */
function z_engine_tweet_mentioned(entities)
{
	var mentioned = false;
	if (entities.user_mentions.length > 0)
	{
		for (var mention = entities.user_mentions.length; mention--;)
		{
			if (entities.user_mentions[mention].screen_name === screen_name)
			{
				mentioned = true;
				break;
			}
		}
	}
	return mentioned;
}

/* still a temporary hack to stop the engine from spitting out new tweets into (only) the home timeline */
function z_engine_tweet_pause()
{
	if (!paused)
	{
		paused = true;
		$("pause").update("paused");
	}
	else
	{
		for (i = 0; i <= content_paused.length; i++)
		{
			if (typeof(content_paused[i]) === "undefined")
			{
				//do nothing
			}
			else
			{
				if (content_paused[i].isJSON())
				{
					var data = content_paused[i].evalJSON();
					z_engine_tweet(data,"home");
				}
			}
		}
		content_paused = Array();
		paused = false;
		pttid = 0;
		$("pause").update("pause");
	}
}

/* hold the data in a temporary array */
function z_engine_tweet_pause_handler(data)
{
	if (data.isJSON())
	{
		content_paused[pttid] = JSON.stringify(data);
		pttid++;
	}
}

/* favorite a tweet */
function z_engine_unfavorite(id)
{
	socket.send({unfavorite: {status: {id_str: id}}});
	$("fave-"+id).writeAttribute("src","img/fav.png");
	$("fave-"+id).writeAttribute("onclick","z_engine_unfavorite('"+id+"');");
}

/* update all time elements */
function z_engine_update_relative_time()
{
	var time_elements = $$("time");
	for (var stamp = time_elements.length; stamp--;)
	{
		var this_stamp = time_elements[stamp].getAttribute("datetime");
		time_elements[stamp].update(relative_time(this_stamp));
	}
}

/*
 * other functions used by the engine
 */

/* replacement for cloneNode to carry events over  */
function cloneNodeWithEvents(orgNode)
{
	var orgNodeEvenets = orgNode.getElementsByTagName('*');
	var cloneNode = orgNode.cloneNode(true);
	var cloneNodeEvents = cloneNode.getElementsByTagName('*');
	var allEvents = new Array('onabort','onbeforecopy','onbeforecut','onbeforepaste','onblur',
	'onchange','onclick','oncontextmenu','oncopy','ondblclick','ondrag','ondragend','ondragenter',
	'ondragleave','ondragover','ondragstart', 'ondrop','onerror','onfocus','oninput','oninvalid',
	'onkeydown','onkeypress','onkeyup','onload','onmousedown','onmousemove','onmouseout','onmouseover',
	'onmouseup', 'onmousewheel', 'onpaste','onreset', 'onresize','onscroll','onsearch', 'onselect',
	'onselectstart','onsubmit','onunload');
	for(var j=0; j<allEvents.length; j++)
	{
		eval('if(orgNode.'+allEvents[j]+') cloneNode.'+allEvents[j]+' = orgNode.'+allEvents[j]);
	}
	for(var i=0 ; i<orgNodeEvenets.length; i++)
	{
		for(var j=0; j<allEvents.length; j++)
		{
			eval('if(orgNodeEvenets[i].'+allEvents[j]+') cloneNodeEvents[i].'+allEvents[j]+' = orgNodeEvenets[i].'+allEvents[j]);
		}
	}
	return cloneNode;
}

/* parse and convert the majority of our timestamps */
var relative_time = function (a)
{
	var K = function ()
	{
		var a = navigator.userAgent;
		return{
			ie: a.match(/MSIE\s([^;]*)/)
		}
	}();
	var b = new Date();
	var c = new Date(a);
	if (K.ie)
	{
		c = Date.parse(a.replace(/( \+)/, ' UTC$1'))
	}
	var d = b - c;
	var e = 1000,
	minute = e * 60,
	hour = minute * 60,
	day = hour * 24,
	week = day * 7,
	month = day * 30,
	year = month * 12;
	if (isNaN(d) || d < 0)
	{
		return "";
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
		return "a minute ago";
	}
	if (d < hour)
	{
		return Math.floor(d / minute) + " minutes ago";
	}
	if (d < hour * 2)
	{
		return "an hour ago";
	}
	if (d < day)
	{
		return Math.floor(d / hour) + " hours ago";
	}
	if (d > day && d < day * 2)
	{
		return "a day ago";
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
	if (d > month)
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
