declare const self: ServiceWorkerGlobalScope;

const cacheName = 'babydbg-v1';

self.addEventListener('install', (event: ExtendableEvent) => {
	console.log('service worker installed');
	event.waitUntil((async () => {
		const cache = await caches.open(cacheName);
		await cache.addAll([
			'/',
			'/static/app.js',
			'/static/icon.png',
			'/static/icon.svg',
			'/static/style.css',
		]);
		self.skipWaiting();
	})());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
	console.log('service worker waiting to activate');
	event.waitUntil((async () => {
		const keyList = await caches.keys();
		await Promise.all(keyList.map((key) => {
			if (key !== cacheName)
				return caches.delete(key);
		}));
	})());
});

self.addEventListener('fetch', (event: FetchEvent) => {
	event.respondWith((async () => {
		const cache = await caches.open(cacheName);
		try {
			const networkResponse = await fetch(event.request);
			if (networkResponse.ok)
				await cache.put(event.request, networkResponse.clone());
			return networkResponse;
		} catch (err) {
			let request: RequestInfo | URL = event.request;
			if (request.url.startsWith('/baby/'))
				request = '/';
			const cachedResponse = await cache.match(request);
			if (cachedResponse)
				return cachedResponse;
			throw err;
		}
	})());
});