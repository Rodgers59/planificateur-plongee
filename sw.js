// Nom du cache. J'incrémente la version pour forcer la mise à jour.
const CACHE_NAME = 'dive-planner-cache-v8';

// Liste des fichiers essentiels à mettre en cache pour que l'application fonctionne hors ligne.
const URLS_TO_CACHE = [
  'index.html',
  'google88.css',
  'google88.js',
  'manifest.json',
  'fond-raie-manta.jpg',
  'cursorplongeur3.png',
  'icon-192.png',  // Chemin corrigé
  'icon-512.png',  // Chemin corrigé
  'screenshot-desktop.png', // Chemin corrigé
  'screenshot-mobile.png', // Chemin corrigé
  'xlsx.full.min.js' // <-- MODIFIÉ ICI 
];

// Le reste du fichier sw.js reste identique...
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation v3...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Mise en cache des fichiers de l\'application');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Service Worker: Échec de la mise en cache', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation v3...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Nettoyage de l\'ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});