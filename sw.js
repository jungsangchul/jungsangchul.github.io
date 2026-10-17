// YURA portal — 설치(PWA)용 최소 서비스워커. 캐시 없음: 항상 네트워크에서 최신 파일을 받습니다.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){});
