var sys = require('sys');
var nStore = require('nstore');

module.exports = function(connect)
{
	var Store = connect.session.Store;

	function nStoreSession(options)
	{
		options = options || {};
		options.maxAge = options.maxAge || 3600000;
		Store.call(this, options);
		var dbFile = options.dbFile || __dirname + "/../store/sessions.db";
		this.db = nStore.new(dbFile);
	};
	nStoreSession.prototype.__proto__ = Store.prototype;
	nStoreSession.prototype.filterFn = function (doc, meta)
	{
		return doc.lastAccess > Date.now() - options.maxAge;
	};
	nStoreSession.prototype.get = function (hash, fn)
	{
		this.db.get(hash, function(err,data,meta)
		{
			if(err instanceof Error)
			{
				fn();
			}
			else
			{
				fn(null,data,meta);
			}
		});
	};
	nStoreSession.prototype.set = function (hash, sess, fn)
	{
		var exists = false;
		this.db.get(hash, function(err,data,meta)
		{
			if(err instanceof Error)
			{
				fn();
			}
			else
			{
				exists = true;
			}
		});
		if (exists)
		{
			this.db.remove(hash, fn);
		}
		this.db.save(hash, sess, fn);
	};
	nStoreSession.prototype.destroy = function (hash, fn)
	{
		this.db.remove(hash, fn);
	};
	nStoreSession.prototype.length = function (fn)
	{
		process.nextTick(function ()
		{
			fn(this.db.length);
		});
	};
	nStoreSession.prototype.clear = function (fn)
	{
		var count = this.db.length;
		Object.keys(this.db.index).forEach(function (key)
		{
			this.remove(key, function (err)
			{
				if (err) { fn(err); return; }
				count--;
				if (count === 0) {
					fn();
				}
			});
		}, this.db);
	};
	return nStoreSession;
}
