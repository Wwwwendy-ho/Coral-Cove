/* Coral Cove offline support: keeps a copy of the app's files so it still opens without Wi-Fi.
   Network first, so a new upload to GitHub shows up the next time the iPad is online. */
var CACHE = 'coral-cove-20261030h';
var FILES = ['./', 'index.html', 'seed-data.js?v=20261026', 'audio-clips.js?v=20261026', 'storage.js?v=20261026',
             'library.js', 'words.js', 'words-data.js', 'three.min.js', 'reef-models.js', 'win.mp3', 'lobby-song.mp3', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Music streams in pieces (Range requests). A piece can't be stored, so the whole song is saved once in the
// background, and later pieces come from that saved copy (offline too). A saved song is only replaced when
// CACHE above changes, so change it whenever a song file changes.
function rangeFromCache(req, cached) {
  return cached.arrayBuffer().then(function (buf) {
    var m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || ''), size = buf.byteLength;
    var start = m && m[1] ? +m[1] : 0, end = m && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Accept-Ranges': 'bytes' } });
  });
}

// The app's fonts (Fredoka, Nunito Sans) come from Google Fonts. Saved the first time they load online, so the
// app keeps its look offline. Kept until CACHE above changes.
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
function fontFromCache(req) {
  return caches.match(req).then(function (cached) {
    return cached || fetch(req).then(function (res) {
      if (res.ok || res.type === 'opaque') { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (FONT_HOSTS.indexOf(new URL(e.request.url).hostname) >= 0) { e.respondWith(fontFromCache(e.request)); return; }
  if (new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.headers.has('range')) {
    var url = e.request.url.split('#')[0];
    e.respondWith(caches.match(url, { ignoreSearch: true }).then(function (cached) {
      if (cached) return rangeFromCache(e.request, cached);
      e.waitUntil(fetch(url, { credentials: 'same-origin' }).then(function (res) {
        if (res.ok && res.status === 200) return caches.open(CACHE).then(function (c) { return c.put(url, res); });
      }).catch(function () {}));
      return fetch(e.request);
    }));
    return;
  }
  e.respondWith(
    // Ask GitHub every time instead of the browser's 10-minute cache, so an update shows up the
    // first time the app is reopened online. Unchanged files come back as a quick "not modified".
    fetch(e.request.mode === 'navigate' ? e.request.url : e.request, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      if (res.status === 200) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(e.request, copy); }).catch(function () {}); }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
