/*
 * initial variables
 */
var content = Array(); //holds our tweets, allows us to prune it later / not display the same tweet more than twice
var content_paused = Array(); //a cycling temporary array that holds the tweets we miss when paused
var cutoff = 250; //max amount of tweets to display before pruning occurs
var following = Array(); //holds our following id's array
var ids = Array(); //work in progress to get the "just now" to update every 15 / 20 seconds
var in_reply_to_status_id = false;
var paused = false; //allow the engine itself to be momentarily 'paused'..not sure how im going to work this out properly
var page = 1; //the page we start on (on the home timeline)
var reply_id = "";
var screen_name = "";
var socket = new io.Socket(); //socket.io, duh
var tid = 0; //internal counter
var ttid = 0; //temporary internal counter
var user_id = 0;

/*
 * the websocket itself
 */
function z_engine_attrition()
{
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
			new Event.observe("home-timeline-click", "click", function(event)
			{
				Event.stop(event);
				if ($("mentions-timeline").visible())
				{
					new S2.FX.Parallel(
					[
						new Effect.Fade("mentions-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.BlindUp("mentions-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.BlindDown("home-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.Appear("home-timeline",
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
			new Event.observe("mentions-timeline-click", "click", function(event)
			{
				Event.stop(event);
				if ($("home-timeline").visible())
				{
					new S2.FX.Parallel(
					[
						new Effect.Fade("home-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.BlindUp("home-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.BlindDown("mentions-timeline",
						{
							duration: 0.25,
							mode: 'relative'
						}),
						new Effect.Appear("mentions-timeline",
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
			var update_relative_time = window.setInterval(function()
			{
				this.z_engine_update_relative_time()
			},15000);
			var populate_mentions_tab = window.setTimeout(function()
			{
				this.socket.send({fetch: "mentions"});
			},5000);
		}
		else if (json.delete)
		{
			if ($("comment-"+json.delete.status.id_str))
			{
				$("comment-"+json.delete.status.id_str).remove(); //add effects here later
			}
		}
		else if (json.event)
		{
			//here we will handle events, some examples would be:
				//list_member_added
				//list_member_removed
				//favorite
				//unfavorite
				//follows
		}
		else if (json.friends)
		{
			following = JSON.stringify(json.friends);
		}
		else if (json.info)
		{
			screen_name = json.info.screen_name;
			user_id = json.info.user_id;
		}
		else if (json.mentions)
		{
			for (i = 0; i < json.mentions.length; i++)
			{
				z_engine_tweet(json.mentions[i], "mentions");
			}
		}
		else if (json.text && json.user && json.created_at) //ensure we are about to do this to a valid tweet
		{
			if (!paused)
			{
				z_engine_tweet(json, "home");
				z_engine_clean_tweets();
			}
		}
	});
	socket.on('disconnect', function()
	{
		$("new-tweet").disable();
		$("new-tweet-submit").disable();
		$("new-tweet").setValue("lost connection, reconnecting...");
		setTimeout(function(){window.location.reload();},5000);
	});
}

/*
 * hopefully this will hopefully trim older tweets later on (when you get around 50 or so logged up)
 */
function z_engine_clean_tweets()
{
	var tweet_elements = $("home-timeline").childElements();
	for (i = 0; i < tweet_elements.length; i++)
	{
		if (i > cutoff)
		{
			$(tweet_elements[i]).remove();
			console.log("dropped "+tweet_elements[i]);
		}
	}
}
/*
 * starts up the engine
 */
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

/*
 * parse and convert all mentions, links, and hashtags appropriately into their respective links
 */
function z_engine_parse_tweet(text)
{
	if(!text)
	{
		return text;
	}
	else
	{
		text = text.replace(/((https?\:\/\/)|(www\.))([^ ]+)/g, function(url)
		{
			return '<a target="_blank" href="'+ url +'">'+url.replace(/^www./i,'')+'</a>';
		});
		text = text.replace(/@([\w*]+)/g, function(user)
		{
			return '<a target="_blank" href="http://twitter.com/'+user+'">'+user+'</a>';
		})+" ";
		text = text.replace(/#([\w*]+)/g, function(tag)
		{
			return '<a target="_blank" href="http://search.twitter.com/search?q='+tag.replace(/#/i,'%23')+'">'+tag+'</a>';
		})+" ";
		return text;
	}
}

/*
 * todo: explain me
 */
function z_engine_reply_to_tweet(id, author)
{
	reply_id = id;
	$("new-tweet").setValue("@"+author+" ");
	$("new-tweet").focus();
}

/*
 * send our tweet
 */
function z_engine_send_tweet()
{
	if ($("new-tweet").getValue().length > 0)
	{
		$("new-tweet").disable();
		$("new-tweet-submit").disable();
		var temp_element = $("new-tweet").getValue();
		var text_element = new Element('input',
		{
			'id': 'new-tweet-text',
			'name': 'status',
			'value': temp_element,
			'type': 'hidden'
		});
		var reply_element = new Element('input',
		{
			'id': 'in-reply-to-status-id',
			'name': 'in_reply_to_status_id',
			'value': reply_id,
			'type': 'hidden'
		});
		var include_entities_element = new Element('input',
		{
			'id': 'include-entities',
			'name': 'include_entities',
			'value': 'true',
			'type': 'hidden'
		});
		$("new-tweet-form").insert(text_element);
		$("new-tweet-form").insert({'bottom': reply_element});
		$("new-tweet-form").insert({'bottom': include_entities_element});
		var params = $("new-tweet-form").serialize(true);
		socket.send(params);
		$("new-tweet-text").remove();
		$("in-reply-to-status-id").remove();
		$("include-entities").remove();
		reply_id = "";
		$("new-tweet").setValue("");
		$("new-tweet").enable();
		$("new-tweet-submit").enable();
	}
}

/*
 * the engine that handles, sorts, and displays our data
 */
function z_engine_tweet(data, output)
{
	if (!data.retweeted_status)
	{
		var author = data.user.screen_name;
		var author2 = false;
		var avatar = data.user.profile_image_url;
		var date = new Date(data.created_at).toLocaleString().replace(/GMT.+/,''); //fix some "blank dates"
		var entities = data.entities;
		var faved = data.favorited;
		var id = data.id_str;
		var locked = data.user.protected;
		var name = data.user.name;
		var reply = data.in_reply_to_screen_name;
		var replyid = data.in_reply_to_status_id_str;
		var rtd = false;
		var source = data.source;
		var text = data.text.replace(/\n\r?/g, '<br />');
		var userid = data.user.id;
		var verified = data.user.verified;
	}
	else
	{
		var author = data.retweeted_status.user.screen_name;
		var author2 = data.user.screen_name;
		var avatar = data.retweeted_status.user.profile_image_url;
		var date = new Date(data.retweeted_status.created_at).toLocaleString().replace(/GMT.+/,''); //fix some "blank dates"
		var entities = data.retweeted_status.entities;
		var faved = data.retweeted_status.favorited;
		var id = data.retweeted_status.id_str;
		var locked = data.retweeted_status.user.protected;
		var name = data.retweeted_status.user.name;
		var reply = data.retweeted_status.in_reply_to_screen_name;
		var replyid = data.retweeted_status.in_reply_to_status_id_str;
		var rtd = true;
		var source = data.retweeted_status.source;
		var text = data.retweeted_status.text.replace(/\n\r?/g, '<br />');
		var userid = data.retweeted_status.user.id;
		var verified = data.retweeted_status.user.verified;
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
			var comment_content_element = new Element('div', {id: 'comment-'+id+'content', 'class': 'comment-content-wrapper right'});
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
				var comment_body_element = new Element('div', {'class': 'comment-body-me'}); //a noticable purple shadow
			}
					var comment_arrow_element = new Element('div', {'class': 'comment-arrow'});
					comment_body_element.insert(comment_arrow_element);
					var comment_date_element = new Element('div', {'class': 'post-date'});
						var left_element = new Element('div', {'class': 'left'});
							var author_link_element = new Element('a', {'target': '_blank', href: 'http://twitter.com/'+author});
							author_link_element.update('@'+author+' ');
							var wrote_this_element = new Element('span');
							wrote_this_element.update('wrote this ');
							var status_link_element = new Element('a', {'target': '_blank', id: 'comment-'+id+'-relative-date', href: 'http://twitter.com/'+author+'/status/'+id});
							var status_time_element = new Element('time', {'datetime': date});
							status_time_element.update(relative_time(date));
								Element.extend(status_time_element);
								status_link_element.insert(status_time_element);
							var via_source_element = new Element('span');
							via_source_element.update(' via '+source);
							left_element.insert(author_link_element);
							left_element.insert({'bottom': wrote_this_element});
							left_element.insert({'bottom': status_link_element});
							if (replyid)
							{
								var in_reply_to_element = new Element('span');
								in_reply_to_element.update('in reply to ');
								var in_reply_to_link_element = new Element('a', {'target': '_blank', href: 'http://twitter.com/'+reply+'/status/'+replyid});
								in_reply_to_link_element.update(reply+' ');
								left_element.insert(in_reply_to_element);
								left_element.insert({'bottom': in_reply_to_link_element});
							}
							left_element.insert({'bottom': via_source_element});
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
								if (author != screen_name)
								{
									var reply_img_element = new Element('img', {'src': 'img/rep.png', id: 'reply-'+id, 'alt': ''});
									if (!locked)
									{
										var rt_img_element = new Element('img', {'src': 'img/rt.png', id: 'rt-'+id, 'alt': ''});
									}
									else
									{
										var rt_img_element = new Element('img', {'src': 'img/lock.png', 'alt': ''});
									}
									if (!faved)
									{
										var fave_img_element = new Element('img', {'src': 'img/fav.png', id: 'fave-'+id, 'alt': 'true'});
									}
									else
									{
										var fave_img_element = new Element('img', {'src': 'img/favd.png', id: 'fave-'+id, 'alt': 'false'});
									}
									right2_element.insert(reply_img_element);
									right2_element.insert({'bottom': rt_img_element});
									right2_element.insert({'bottom': fave_img_element});
								}
								else
								{
									var del_img_element = new Element('img', {'src': 'img/del.png', id: 'del-'+id, 'alt': ''});
									right2_element.insert(del_img_element);
								}
							comment_text_body_element.insert(linebreak);
							comment_text_body_element.insert({'bottom': right2_element});
							var tweet_text = new Element('div', {id: "text-"+id});
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
			case 'mentions':
				$("mentions-timeline").insert({'top': container_element});
			break;
			case 'home':
				$("home-timeline").insert({'top': container_element});
				if (mentioned)
				{
					var mentioned_clone = $(container_element.cloneNode(true));
					mentioned_clone.setAttribute("id","comment-mentioned-"+id);
					$("mentions-timeline").insert({'top': mentioned_clone});
				}
			break;
		}
		if (author != screen_name)
		{
			new Event.observe('reply-'+id, 'click', function(event)
			{
				Event.stop(event);
				z_engine_reply_to_tweet(id, author);
			});
			if (!locked)
			{
				new Event.observe('rt-'+id, 'click', function(event)
				{
					var confirm_rt = confirm("\nOK: regular retweet\nCancel: commented RT\n");
					if (confirm_rt)
					{
						z_engine_tweet_event_handler(event, {retweet: {status: {id_str: id}}}, "retweet", id);
					}
					else
					{
						$("new-tweet").setValue("RT @"+author+" "+text);
						$("new-tweet").focus();
					}
				});
			}
			if (!faved)
			{
				new Event.observe('fave-'+id, 'click', function(event)
				{
					z_engine_tweet_event_handler(event, {favorite: {status: {id_str: id}}}, "favorite", id);
				});
			}
			else
			{
				new Event.observe('fave-'+id, 'click', function(event)
				{
					z_engine_tweet_event_handler(event, {unfavorite: {status: {id_str: id}}}, "unfavorite", id);
				});
			}
		}
		else
		{
			new Event.observe('del-'+id, 'click', function(event)
			{
				z_engine_tweet_event_handler(event, {delete: {status: {id_str: id}}}, "delete", id);
			});
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
		if (mentioned)
		{
			new S2.FX.Parallel(
			[
				new Effect.Appear('comment-mentioned-'+id,
				{
					duration: 1.25,
					mode: 'relative'
				}),
				new Effect.BlindDown('comment-mentioned-'+id,
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
	if (!mentioned)
	{
		tid++;
	}
}

/*
 * clear everything out (view & content var wise)
 */
function z_engine_tweet_clear()
{
	content = Array();
	ids = Array();
	tid = 0;
	$("home-timeline").update();
}

function z_engine_tweet_event_handler(event, params, resource, id, author, text)
{
	Event.stop(event);
	switch (resource)
	{
		case 'delete':
			socket.send(params); //it may look blank but we will be handling this elsewhere in the engine
		break;
		case 'favorite':
			Element.extend("fave-"+id);
			$("fave-"+id).writeAttribute("src","img/favd.png");
			$("fave-"+id).stopObserving();
			new Event.observe('fave-'+id, 'click', function(event2)
			{
				Event.stop(event2);
				z_engine_tweet_event_handler(event2, {unfavorite: {status: {id_str: id, include_entities: true}}}, "unfavorite", id);
			});
		break;
		case 'unfavorite':
			Element.extend("fave-"+id);
			$("fave-"+id).writeAttribute("src","img/fav.png");
			$("fave-"+id).stopObserving();
			new Event.observe('fave-'+id, 'click', function(event2)
			{
				Event.stop(event2);
				z_engine_tweet_event_handler(event2, {favorite: {status: {id_str: id, include_entities: true}}}, "favorite", id);
			});
		break;
		case 'retweet':
			Element.extend("rt-"+id);
			$("rt-"+id).writeAttribute("src","img/rtd.png");
			$("rt-"+id).stopObserving();
			//todo: come up with a way to store the returned retweet id so it can be undone if needed
		break;
	}
	socket.send(params);
}

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

function z_engine_tweet_paused_recieve(data)
{
	if (!data.retweeted_status)
	{
		var id = data.id_str;
	}
	else
	{
		var id = data.retweeted_status.id_str;
	}
	if (!content[id] && !content_paused[id])
	{
		content_paused[ttid] = data;
	}
	ttid++;
}

function z_engine_tweet_pause()
{
	if (!paused)
	{
		paused = true;
	}
	else
	{
		paused = false;
	}
}

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
 * parse and convert the majority of our timestamps
 */
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
	if (d > year)relative_time(date)
	{
		return Math.floor(d / year) + " years ago";
	}
};
