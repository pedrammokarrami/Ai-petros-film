/* aipetros-sound Persistent Graphic & 3D Asset Cache Service Worker
 * Downloads & serves all .glb/.gltf/.bin models, Poly Haven PBR textures, .hdr environments,
 * images, and Draco decoders directly from local device CacheStorage after first fetch.
 * Strictly bypasses /api/*, /ws/*, Vite dev modules (/src/, /@vite/, /node_modules/), and HTML navigation
 * so app logic always stays live while every 3D graphic renders instantaneously from local storage.
 */
const ASSET_CACHE_NAME = 'aipetros-sound-assets-v1';

const IMMUTABLE_PATH_PREFIXES = [
  '/models/',
  '/textures/',
  '/hdr/',
  '/hdri/',
  '/assets/'
];

function isCacheableAssetRequest(request) {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate') return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  const pathname = url.pathname;

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/ws/') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/@fs') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/')
  ) {
    return false;
  }

  if (url.origin === self.location.origin) {
    for (let i = 0; i < IMMUTABLE_PATH_PREFIXES.length; i++) {
      if (pathname.startsWith(IMMUTABLE_PATH_PREFIXES[i])) {
        return true;
      }
    }
    return /\.(glb|gltf|hdr|exr|wasm|bin|ktx2|jpg|jpeg|png|webp|svg|woff2)$/i.test(pathname);
  }

  const href = url.href;
  return (
    href.includes('gstatic.com/draco') ||
    href.includes('dl.polyhaven.org') ||
    href.includes('readyplayerme') ||
    (/\.(glb|hdr|wasm|js)$/i.test(pathname) &&
      (url.hostname.includes('gstatic.com') || url.hostname.includes('githubusercontent.com')))
  );
}

function parseByteRange(rangeHeader, totalLength) {
  const match = /bytes=(\d+)-(\d*)/i.exec(rangeHeader || '');
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const end = match[2] ? Math.min(totalLength - 1, parseInt(match[2], 10)) : totalLength - 1;
  if (Number.isNaN(start) || start < 0 || start >= totalLength || end < start) {
    return null;
  }
  return { start, end };
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                (k.startsWith('aipetros-sound-assets-') || k.startsWith('aether-3d-assets-')) &&
                k !== ASSET_CACHE_NAME
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isCacheableAssetRequest(req)) return;

  const rangeHeader = req.headers.get('range');
  const cacheKeyUrl = req.url;

  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE_NAME);
      const cachedFull = await cache.match(cacheKeyUrl);

      if (rangeHeader) {
        if (cachedFull && cachedFull.status === 200) {
          const buf = await cachedFull.arrayBuffer();
          const range = parseByteRange(rangeHeader, buf.byteLength);
          if (range) {
            const slice = buf.slice(range.start, range.end + 1);
            const headers = new Headers(cachedFull.headers);
            headers.set('Content-Length', String(slice.byteLength));
            headers.set('Content-Range', `bytes ${range.start}-${range.end}/${buf.byteLength}`);
            return new Response(slice, {
              status: 206,
              statusText: 'Partial Content',
              headers
            });
          }
        }
        return fetch(req);
      }

      if (cachedFull) {
        return cachedFull;
      }

      const networkRes = await fetch(req);
      if (networkRes && networkRes.status === 200) {
        const ct = (networkRes.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('text/html')) {
          cache.put(cacheKeyUrl, networkRes.clone()).catch(() => {});
        }
      }
      return networkRes;
    })()
  );
});
