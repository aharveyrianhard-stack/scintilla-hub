/* SCINTILLA · N2 (15 Oct 2026) — the push service worker. ONE job: a push arrives, a notification is shown; a tap on
   it opens the place the message names. It controls NO page (registered with scope /push/, a path nothing lives at),
   caches nothing and never answers a fetch — the Hub stays pure-network, as sw.js (the kill switch) made it.
   index.html's worker-clearing block leaves a /push/-scoped worker alone (N2); every other registration is still removed. */
self.addEventListener("install", function (e) { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SCINTILLA", body: e.data ? e.data.text() : "" }; }
  var title = d.title || "SCINTILLA";
  var opts = {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || d.key || undefined,       /* the same key replaces, never stacks */
    renotify: false,
    data: { url: d.url || "/" },
    timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now(),
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      try { if (new URL(cs[i].url).origin === self.location.origin && "focus" in cs[i]) { cs[i].navigate(url); return cs[i].focus(); } } catch (_) {}
    }
    return self.clients.openWindow(url);
  }));
});
