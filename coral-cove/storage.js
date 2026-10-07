/*
 * Coral Cove — on-device storage.
 *
 * Inside Claude, Coral Cove saves decks and progress to the artifact's online database through
 * window.claude.use('db'). On GitHub Pages that doesn't exist, so this file provides the same
 * small database interface, saved in the iPad's own storage (localStorage) instead.
 *
 * - The starting decks, profiles and progress come from seed-data.js.
 * - Anything from seed-data.js that a device doesn't have yet is added the next time it opens,
 *   without overwriting progress already saved there. (This also repairs a device that first
 *   opened the site before every file had finished uploading.)
 * - Everything saves on that device only. Clearing website data in Settings erases it.
 * - Inside Claude (window.claude already exists) this file does nothing.
 */
(function () {
  if (window.claude && window.claude.use) return;

  var KEY = 'coralCove.db.v1';
  var META = '__coralCoveMeta';
  var seed = window.CORAL_COVE_SEED;
  var seedVersion = window.CORAL_COVE_SEED_VERSION || 'unversioned';
  var docs = {};
  var canSave = true;

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  if (!seed) {
    // seed-data.js didn't load. Don't save anything, so a later visit (once the file is there)
    // still starts from the real data, and tell whoever is looking.
    canSave = false;
    showProblem('Coral Cove couldn’t load its decks (the file seed-data.js is missing or still uploading). ' +
      'Check that every file is in your GitHub repository, wait a minute, then close and reopen Coral Cove.');
  } else {
    try {
      var saved = localStorage.getItem(KEY);
      docs = saved ? JSON.parse(saved) : {};
    } catch (e) {
      canSave = false;
      docs = {};
    }
    var meta = docs[META] || {};
    if (meta.seedVersion !== seedVersion) {
      // Add every starting document this device doesn't have yet; keep everything it does have.
      Object.keys(seed).forEach(function (p) {
        if (!Object.prototype.hasOwnProperty.call(docs, p)) docs[p] = clone(seed[p]);
      });
      docs[META] = { seedVersion: seedVersion, mergedAt: Date.now() };
      writeNow();
    }
  }

  // Ask the browser not to clear this site's storage on its own (Home Screen apps already keep it).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  function writeNow() {
    if (!canSave) return;
    try { localStorage.setItem(KEY, JSON.stringify(docs)); }
    catch (e) {
      console.error('[Coral Cove] could not save on this device', e);
      showProblem('This iPad couldn’t save Coral Cove’s progress (storage is full or blocked). ' +
        'Private Browsing can cause this — open Coral Cove from its Home Screen icon instead.');
    }
  }
  var saveTimer = null;
  function persist() {
    if (!canSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; writeNow(); }, 50);
  }
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; writeNow(); } }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

  function showProblem(msg) {
    function add() {
      if (document.getElementById('coralCoveStorageProblem')) return;
      var d = document.createElement('div');
      d.id = 'coralCoveStorageProblem';
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#ffe1e1;color:#7a1c1c;' +
        'font:700 15px/1.4 -apple-system,system-ui,sans-serif;padding:14px 16px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.2)';
      d.textContent = '⚠️ ' + msg;
      document.body.appendChild(d);
    }
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  }

  var listeners = {}; // collection path -> [{order, cb, active}]

  function parentOf(path) { return path.slice(0, path.lastIndexOf('/')); }
  function newId() {
    var s = '', c = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function has(path) { return path !== META && Object.prototype.hasOwnProperty.call(docs, path); }

  function makeDocSnap(path) {
    var exists = has(path);
    var data = exists ? clone(docs[path]) : undefined;
    return {
      id: path.slice(path.lastIndexOf('/') + 1),
      exists: exists,
      ref: docRef(path),
      data: function () { return clone(data); }
    };
  }

  function queryDocs(coll, order) {
    var prefix = coll + '/';
    var list = [];
    Object.keys(docs).forEach(function (p) {
      if (p !== META && p.indexOf(prefix) === 0 && p.slice(prefix.length).indexOf('/') === -1) list.push(makeDocSnap(p));
    });
    if (order) {
      var f = order.field, dir = order.dir === 'desc' ? -1 : 1;
      list = list.filter(function (d) { return docs[prefix + d.id][f] !== undefined; });
      list.sort(function (a, b) {
        var x = docs[prefix + a.id][f], y = docs[prefix + b.id][f];
        return x < y ? -dir : x > y ? dir : 0;
      });
    } else {
      list.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    }
    return {
      docs: list, size: list.length, empty: list.length === 0,
      forEach: function (cb) { list.forEach(cb); }
    };
  }

  function notify(coll) {
    (listeners[coll] || []).slice().forEach(function (l) {
      setTimeout(function () { if (l.active) l.cb(queryDocs(coll, l.order)); }, 0);
    });
  }

  function write(path, data) { docs[path] = clone(data); persist(); notify(parentOf(path)); }

  function docRef(path) {
    return {
      id: path.slice(path.lastIndexOf('/') + 1),
      path: path,
      get: function () { return Promise.resolve(makeDocSnap(path)); },
      set: function (data, opts) {
        var base = (opts && opts.merge && has(path)) ? docs[path] : {};
        write(path, Object.assign({}, clone(base), clone(data)));
        return Promise.resolve();
      },
      update: function (data) {
        write(path, Object.assign({}, clone(has(path) ? docs[path] : {}), clone(data)));
        return Promise.resolve();
      },
      delete: function () {
        if (has(path)) { delete docs[path]; persist(); notify(parentOf(path)); }
        return Promise.resolve();
      },
      collection: function (sub) { return collRef(path + '/' + sub); }
    };
  }

  function collRef(path, order) {
    return {
      path: path,
      doc: function (id) { return docRef(path + '/' + (id || newId())); },
      add: function (data) {
        var ref = docRef(path + '/' + newId());
        return ref.set(data).then(function () { return ref; });
      },
      get: function () { return Promise.resolve(queryDocs(path, order)); },
      orderBy: function (field, dir) { return collRef(path, { field: field, dir: dir || 'asc' }); },
      onSnapshot: function (cb) {
        var l = { order: order, cb: cb, active: true };
        (listeners[path] = listeners[path] || []).push(l);
        setTimeout(function () { if (l.active) cb(queryDocs(path, order)); }, 0);
        return function () {
          l.active = false;
          listeners[path] = (listeners[path] || []).filter(function (x) { return x !== l; });
        };
      }
    };
  }

  var audio = window.CORAL_COVE_AUDIO || {};
  var db = {
    collection: function (path) { return collRef(path); },
    doc: function (path) {
      // Recorded pronunciation clips are bundled read-only and never saved to device storage.
      if (path.indexOf('audio-clips/') === 0) {
        var found = Object.prototype.hasOwnProperty.call(audio, path);
        return { get: function () { return Promise.resolve({ id: path.split('/').pop(), exists: found, data: function () { return clone(audio[path]); } }); } };
      }
      return docRef(path);
    }
  };

  window.claude = {
    use: function (name) {
      if (name === 'db') return Promise.resolve(db);
      // Photo uploads need Claude's online storage, so they stay off here.
      return Promise.reject(new Error(name + ' is not available outside Claude'));
    }
  };
})();
