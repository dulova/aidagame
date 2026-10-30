// Cache cleanup never touches IndexedDB or caches belonging to other applications.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('muroblocks-static-')).map(name => caches.delete(name)))));
});
