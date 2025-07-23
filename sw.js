// Nom du cache. Changez ce nom pour forcer la mise à jour du cache.
const CACHE_NAME = 'dive-planner-cache-v1';

// Liste des fichiers essentiels à mettre en cache pour que l'application fonctionne hors ligne.
const URLS_TO_CACHE = [
  'google88.html',
  'google88.css',
  'google88.js',
  'manifest.json',
  'fond-raie-manta.jpg',
  'cursorplongeur3.png',
  'images/icon-192.png',
  'images/icon-512.png',
  // La librairie externe. C'est crucial de la mettre en cache aussi !
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' 
];

// --- Étape 1: Installation du Service Worker ---
// Ce code s'exécute une seule fois, lorsque le SW est installé.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installation...');
  
  // On demande au navigateur d'attendre que la promesse soit résolue.
  event.waitUntil(
    // On ouvre notre cache par son nom.
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Mise en cache des fichiers de l\'application');
        // On ajoute tous les fichiers de notre liste au cache.
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Service Worker: Échec de la mise en cache', err);
      })
  );
});

// --- Étape 2: Activation du Service Worker ---
// Ce code s'exécute après l'installation, quand le SW devient actif.
// C'est le bon moment pour nettoyer les anciens caches.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Si on trouve un cache qui ne correspond pas au nom actuel, on le supprime.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Nettoyage de l\'ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- Étape 3: Interception des requêtes réseau ---
// C'est le cerveau du mode hors ligne.
// Le SW intercepte chaque requête de la page (fetch).
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // On cherche d'abord dans le cache si une réponse correspond à la requête.
    caches.match(event.request)
      .then((response) => {
        // Si on trouve une réponse dans le cache...
        if (response) {
          // ... on la retourne directement, sans aller sur le réseau. C'est rapide !
          return response;
        }
        // Si on ne trouve rien dans le cache, on fait la requête réseau normale.
        return fetch(event.request);
      }
    )
  );
});