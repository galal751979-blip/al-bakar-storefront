self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(client => {
      try {
        return client.navigate(client.url).catch(() => null);
      } catch {
        return Promise.resolve(null);
      }
    }));
  })());
});
