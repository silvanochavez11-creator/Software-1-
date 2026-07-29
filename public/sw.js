// Service worker mínimo: solo existe para que la app se pueda instalar
// ("Agregar a pantalla de inicio"). NO intercepta ni cachea NADA: el
// listener de fetch está vacío a propósito, así el navegador maneja todas
// las peticiones de forma normal (login, Supabase, API) y siempre se carga
// la versión más nueva publicada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // Limpia cualquier caché que hubiera quedado de versiones anteriores
  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (err) {}
  await self.clients.claim();
})()));
// Handler vacío: requerido para la instalabilidad, sin respondWith.
self.addEventListener("fetch", () => {});
