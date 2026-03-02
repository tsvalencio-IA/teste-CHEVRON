const CACHE_NAME = 'chevron-oficina-v2.2';

// 1. Instalação: Força o novo Service Worker a assumir o controle imediatamente
self.addEventListener('install', event => {
    self.skipWaiting();
});

// 2. Ativação: Limpa QUALQUER cache fantasma/antigo que esteja travando os celulares
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Se o nome do cache for diferente da versão atual, ele DELETA TUDO.
                    // Isso garante que aquele app.js velho suma do celular.
                    if (cacheName !== CACHE_NAME) {
                        console.log('Limpando cache antigo do CHEVRON:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Assume o controle da tela na mesma hora
    );
});

// 3. Estratégia de Busca (Network First - Internet Primeiro)
// Sempre tenta buscar a versão mais recente do servidor. Só usa o cache se estiver sem internet.
self.addEventListener('fetch', event => {
    // Ignora requisições que não sejam GET (como POSTs pro Firebase/Cloudinary)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se a requisição deu certo, salva uma cópia atualizada no cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Se o fetch falhar (ex: sem internet), tenta buscar no cache
                return caches.match(event.request);
            })
    );
});
