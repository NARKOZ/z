var sys = require('sys');
var nStore = require('nstore');
nStore = nStore.extend(require('nstore/query')());

module.exports = function(connect)
{
	var Store = connect.session.Store;

	function filterFn(doc, meta)
	{
		return doc.lastAccess > Date.now() - options.maxAge;
	};

	function nStoreSession(options)
	{
		options = options || {};
		options.maxAge = options.maxAge || 3600000; // Expunge after an hour
		var dbFile = options.dbFile || __dirname + "/../store/sessions.db";
		Store.call(this, options);
		this.db = nStore.new(dbFile);
		if (options.dbFile)
		{
			var self = this;
		}
	};

	nStoreSession.prototype.__proto__ = Store.prototype;

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
