// Früherer zweiter Service Worker für Benachrichtigungen. Beide lagen auf dem Scope „/“ und
// verdrängten sich gegenseitig. Browser, die ihn noch registriert haben, bekommen hier den
// gemeinsamen Service Worker, bis die App ihn durch `service-worker.js` ersetzt.
importScripts("./service-worker.js");
