const C='pflegebuch-static-v7';
const REL=['./','./style.css','./app.js','./searchEngine.js','./planEngine.js','./knowledgeBase.js','./patientStore.js','./i18n.js','./translator.js','./manifest.webmanifest','./icon.svg'];
const asset=u=>new URL(u,self.registration.scope).href;
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(REL.map(asset))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(C).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match(asset('./')))));
});