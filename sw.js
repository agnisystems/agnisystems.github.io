// Agni Systems — Service Worker (অফলাইনে অ্যাপ চালানোর জন্য)
// অ্যাপ আপডেট দিলে নিচের VERSION সংখ্যা বাড়ান।
var VERSION = "agni-v6";
var CORE = ["./", "index.html", "manifest.json", "agni-patch.js", "logo.png", "encrypted.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];
var CDN = [
  "https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js"
];
// এই হোস্টগুলোর অনুরোধ ক্যাশ হবে (Firestore/Auth API কখনো নয়)
var CACHEABLE_HOSTS = ["ajax.googleapis.com", "www.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    var jobs = CORE.map(function (u) { return c.add(u).catch(function () { }); });
    CDN.forEach(function (u) { jobs.push(fetch(u, { mode: "no-cors" }).then(function (r) { return c.put(u, r); }).catch(function () { })); });
    return Promise.all(jobs);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // পেজ নিজে: আগে নেটওয়ার্ক (নতুন সংস্করণ পেতে), না পেলে ক্যাশ
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (r) {
      var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put("index.html", copy); });
      return r;
    }).catch(function () { return caches.match("index.html").then(function (m) { return m || caches.match("./"); }); }));
    return;
  }

  var sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && CACHEABLE_HOSTS.indexOf(url.hostname) < 0) return; // Firestore, Auth ইত্যাদি সরাসরি যাবে

  // স্ট্যাটিক ফাইল: ক্যাশ থেকে দ্রুত দেখায়, পেছনে আপডেট করে
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: sameOrigin }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
