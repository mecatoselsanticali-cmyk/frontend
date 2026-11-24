// Service worker mínimo: hace la app instalable, pero NO cachea nada.
// A propósito: el ERP maneja sesión por cookies httpOnly y datos de negocio
// en vivo (ventas, stock); cachear respuestas de /api o el HTML podría mostrar
// datos viejos o de otra sesión, y retendría versiones antiguas tras un deploy.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// Un handler de fetch es requisito de instalabilidad en algunos navegadores;
// al no llamar a respondWith, la petición sigue directo a la red.
self.addEventListener("fetch", () => {});
