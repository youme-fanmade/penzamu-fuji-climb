/* ぺんざむの！富士山のぼれるかな？ ― Service Worker
   リリースごとに VERSION を index.html のバージョンに合わせて更新すること(古いキャッシュが削除される)。 */
const VERSION = 'v1.04.01';
const CACHE_PRECACHE = 'penzamu-fuji-precache-' + VERSION;
const CACHE_RUNTIME = 'penzamu-fuji-runtime-' + VERSION;

const IMG_DIR = 'assets/images/';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  IMG_DIR + 'title-logo.png',
  IMG_DIR + 'player-walk-left.png',
  IMG_DIR + 'player-walk-right.png',
  IMG_DIR + 'bg-forest.png',
  IMG_DIR + 'bg-rocky-day.png',
  IMG_DIR + 'bg-rocky-day2.png',
  IMG_DIR + 'bg-rocky-cloud.png',
  IMG_DIR + 'summit-fuji.png',
  IMG_DIR + 'rock.png',
  IMG_DIR + 'cloud.png',
  IMG_DIR + 'result-character.png',
  IMG_DIR + 'summit-character.png',
  IMG_DIR + 'favicon/favicon.ico',
  IMG_DIR + 'favicon/apple-touch-icon-180x180.png',
  IMG_DIR + 'favicon/android-chrome-192x192.png',
  IMG_DIR + 'favicon/android-chrome-512x512.png',
];

/* 1件ずつ追加する(画像が無い等で1件失敗しても、全体のインストールは失敗させない。無い画像はゲーム側がプロシージャル描画にフォールバックする)。 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_PRECACHE).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => { })))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names
        .filter((n) => n !== CACHE_PRECACHE && n !== CACHE_RUNTIME)
        .map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

/* HTML: Network First(更新を優先し、オフライン時はキャッシュ)。 */
function networkFirst(request) {
  return fetch(request).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE_PRECACHE).then((c) => c.put(request, copy));
    }
    return res;
  }).catch(() =>
    caches.match(request, { ignoreSearch: true })
      .then((hit) => hit || caches.match('./index.html'))
  );
}

/* 画像・フォント等: Stale-While-Revalidate(キャッシュを即返し、裏で更新)。 */
function staleWhileRevalidate(request) {
  return caches.match(request).then((hit) => {
    const fetching = fetch(request).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE_RUNTIME).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || fetching;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isFont) return; /* Xシェア等、他サイトへの通信には介入しない */

  if (req.mode === 'navigate' || (sameOrigin && url.pathname.endsWith('.html'))) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});
