/**
 * FriendLinks Service Worker
 * 缓存策略：
 * - JS/CSS/WASM/核心二进制文件 → Cache First
 * - 导航（HTML）→ Network First
 * - 其他 → Network Only
 *
 * 更新机制：
 * - 修改 CACHE_NAME 版本号触发全量更新
 * - 浏览器自动对比 sw.js 字节，24h 内检测到变更
 * - EdgeOne CDN 需配置 /sw.js 路径不缓存
 */
const CACHE_NAME = "friendlinks-v1";

const PRECACHE_URLS = [
  "/",
  "/graph-core.bin",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 仅拦截同域请求
  if (url.origin !== location.origin) return;

  // 跳过非 GET 请求
  if (event.request.method !== "GET") return;

  // 静态资源 → Cache First
  if (
    url.pathname.match(/\.(js|css|wasm)$/) ||
    url.pathname === "/graph-core.bin" ||
    url.pathname.startsWith("/vendor-")
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 导航（HTML）→ Network First
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("离线", { status: 503 });
  }
}
