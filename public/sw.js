// Service worker mínimo: hace la app instalable ("Agregar a pantalla de inicio").
// No guarda nada en caché a propósito: así cada visita trae siempre la versión
// más nueva publicada en Vercel y nunca se queda "pegada" una versión vieja.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request));
});
