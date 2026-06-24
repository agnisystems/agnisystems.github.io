// ══════════════════════════════════════════════════════════
//  AGNI SYSTEMS — Firebase Autocomplete v3
//  • Desktop only (mobile-এ কাজ করবে না)
//  • Dropdown: cursor-এর ডান পাশে, viewport-এর মধ্যে
// ══════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ── Mobile হলে সম্পূর্ণ বন্ধ ──
  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  if (isMobile) return;

  // ──────────────────────────────────────────────
  //  1. Config
  // ──────────────────────────────────────────────
  var AC_FIELDS = [
    { id: "fArea",  dbKey: "area",   label: "এলাকা"       },
    { id: "fThana", dbKey: "thana",  label: "থানা"         },
    { id: "fHouse", dbKey: "house",  label: "বাসা"         },
    { id: "fRem",   dbKey: "remark", label: "মন্তব্য"      },
    { id: "eRm",    dbKey: "eRm",    label: "রাউটার মডেল" },
    { id: "eTm",    dbKey: "eTm",    label: "ONU মডেল"    },
    { id: "eROm",   dbKey: "eROm",   label: "Replace ONU" },
  ];

  var UPPER_IDS = [
    "eRm","eRs","eC1s","eC2s",
    "eTm","eOs","eTs","eTsSerial",
    "eTsB","eROm","eROs","eSs",
  ];

  var DD_WIDTH   = 240;   // dropdown প্রস্থ (px)
  var DD_OFFSET  = 10;    // cursor থেকে ডানে ফাঁক (px)
  var DD_MAX_H   = 220;   // max height (px)
  var ITEM_H     = 38;    // প্রতিটি item আনুমানিক উচ্চতা

  // ──────────────────────────────────────────────
  //  2. Cache
  // ──────────────────────────────────────────────
  var _cache     = {};
  var _cacheOk   = false;
  var _mouseX    = 0;
  var _mouseY    = 0;

  // মাউস position সবসময় track করো
  document.addEventListener("mousemove", function (e) {
    _mouseX = e.clientX;
    _mouseY = e.clientY;
  });

  function getDb()  { return window.fsdb || null; }

  function buildFromDB() {
    var db = window.DB;
    if (!db || !db.length) return;
    _cache = {};
    AC_FIELDS.forEach(function (f) {
      var seen = {}, vals = [];
      for (var i = db.length - 1; i >= 0; i--) {
        var v = (db[i][f.dbKey] || "").trim();
        if (v.length >= 2 && !seen[v.toLowerCase()]) {
          seen[v.toLowerCase()] = 1;
          vals.push(v);
        }
      }
      _cache[f.dbKey] = vals;
    });
    _cacheOk = true;
  }

  function buildFromFirestore(cb) {
    var db = getDb();
    if (!db) { if (cb) cb(); return; }
    db.collection("customers").get().then(function (snap) {
      _cache = {};
      var docs = [];
      snap.forEach(function (d) { docs.push(d.data()); });
      docs.sort(function (a, b) { return (Number(b.id)||0) - (Number(a.id)||0); });
      AC_FIELDS.forEach(function (f) {
        var seen = {}, vals = [];
        docs.forEach(function (rec) {
          var v = (rec[f.dbKey] || "").trim();
          if (v.length >= 2 && !seen[v.toLowerCase()]) {
            seen[v.toLowerCase()] = 1;
            vals.push(v);
          }
        });
        _cache[f.dbKey] = vals;
      });
      _cacheOk = true;
      if (cb) cb();
    }).catch(function () { if (cb) cb(); });
  }

  function getMatches(key, q) {
    var list = _cache[key] || [];
    if (!q || !q.trim()) return list.slice(0, 8);
    var lq = q.trim().toLowerCase();
    return list.filter(function (v) {
      return v.toLowerCase().indexOf(lq) >= 0;
    }).slice(0, 8);
  }

  function addToCache(key, val) {
    if (!val || val.trim().length < 2) return;
    var v = val.trim();
    if (!_cache[key]) _cache[key] = [];
    _cache[key] = _cache[key].filter(function (x) {
      return x.toLowerCase() !== v.toLowerCase();
    });
    _cache[key].unshift(v);
  }

  function removeFromCache(key, val) {
    if (!_cache[key]) return;
    _cache[key] = _cache[key].filter(function (x) {
      return x.toLowerCase() !== val.toLowerCase();
    });
  }

  // ──────────────────────────────────────────────
  //  3. Dropdown
  // ──────────────────────────────────────────────
  var _dd    = null;
  var _aInp  = null;
  var _aKey  = null;
  var _fidx  = -1;

  function injectCSS() {
    if (document.getElementById("agni_ac_css")) return;
    var s = document.createElement("style");
    s.id = "agni_ac_css";
    s.textContent = [
      "#agni_ac_dd{",
      "  position:fixed;z-index:999999;",
      "  width:" + DD_WIDTH + "px;",
      "  max-height:" + DD_MAX_H + "px;",
      "  overflow-y:auto;overflow-x:hidden;",
      "  background:#1e293b;",
      "  border:1px solid rgba(255,255,255,.14);",
      "  border-radius:10px;",
      "  box-shadow:0 12px 40px rgba(0,0,0,.55);",
      "  display:none;padding:4px 0;",
      "  font-family:'Hind Siliguri',sans-serif;",
      "  pointer-events:auto;",
      "}",
      "#agni_ac_dd::-webkit-scrollbar{width:4px;}",
      "#agni_ac_dd::-webkit-scrollbar-track{background:transparent;}",
      "#agni_ac_dd::-webkit-scrollbar-thumb{",
      "  background:rgba(255,255,255,.15);border-radius:4px;}",
      ".ac-it{",
      "  padding:9px 12px;font-size:13px;",
      "  color:rgba(255,255,255,.8);cursor:pointer;",
      "  display:flex;align-items:center;gap:8px;",
      "  border-bottom:1px solid rgba(255,255,255,.05);",
      "  transition:background .1s;white-space:nowrap;",
      "}",
      ".ac-it:last-child{border-bottom:none;}",
      ".ac-it:hover,.ac-it.hi{background:rgba(22,163,74,.2);color:#fff;}",
      ".ac-ico{font-size:11px;opacity:.3;flex-shrink:0;}",
      ".ac-txt{flex:1;overflow:hidden;text-overflow:ellipsis;}",
      ".ac-del{font-size:11px;opacity:0;padding:1px 6px;border-radius:4px;",
      "  flex-shrink:0;color:#f87171;transition:opacity .12s,background .12s;}",
      ".ac-it:hover .ac-del{opacity:.55;}",
      ".ac-del:hover{opacity:1!important;background:rgba(220,38,38,.25);}",
      // light
      "body.lg-light #agni_ac_dd{",
      "  background:#fff;border-color:#e2e8f0;",
      "  box-shadow:0 12px 40px rgba(0,0,0,.12);}",
      "body.lg-light .ac-it{color:#334155;border-bottom-color:#f1f5f9;}",
      "body.lg-light .ac-it:hover,body.lg-light .ac-it.hi{",
      "  background:rgba(22,163,74,.09);color:#1e293b;}",
      "body.lg-light .ac-del{color:#dc2626;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function createDD() {
    if (_dd) return;
    injectCSS();
    _dd = document.createElement("div");
    _dd.id = "agni_ac_dd";
    document.body.appendChild(_dd);
  }

  // ── এটাই মূল পরিবর্তন: cursor position থেকে ডানে ──
  function positionDD() {
    if (!_dd) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var itemCount = _dd.querySelectorAll(".ac-it").length;
    var ddH = Math.min(itemCount * ITEM_H + 8, DD_MAX_H);

    // X: cursor-এর ডানে
    var x = _mouseX + DD_OFFSET;
    // viewport-এর বাইরে গেলে বাঁয়ে সরাও
    if (x + DD_WIDTH > vw - 8) {
      x = _mouseX - DD_WIDTH - DD_OFFSET;
    }
    // তারপরও বাইরে হলে clamp
    x = Math.max(6, Math.min(x, vw - DD_WIDTH - 6));

    // Y: cursor-এর কাছাকাছি (একটু নিচে)
    var y = _mouseY - 10;
    // নিচে জায়গা আছে কিনা
    if (y + ddH > vh - 6) {
      y = _mouseY - ddH + 10;
    }
    y = Math.max(6, Math.min(y, vh - ddH - 6));

    _dd.style.left = x + "px";
    _dd.style.top  = y + "px";
  }

  function showDD(inp, key, query) {
    var matches = getMatches(key, query);
    if (!matches.length) { hideDD(); return; }

    _aInp = inp;
    _aKey = key;
    _fidx = -1;

    _dd.innerHTML = matches.map(function (val, i) {
      var esc = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return '<div class="ac-it" data-v="' + esc + '" data-i="' + i + '">'
        + '<span class="ac-ico">↩</span>'
        + '<span class="ac-txt">' + esc + '</span>'
        + '<span class="ac-del" data-d="' + esc + '" title="মুছুন">✕</span>'
        + '</div>';
    }).join("");

    _dd.style.display = "block";
    positionDD();

    _dd.querySelectorAll(".ac-it").forEach(function (it) {
      it.addEventListener("mousedown", function (e) {
        var del = e.target.closest(".ac-del");
        if (del) {
          e.preventDefault(); e.stopPropagation();
          removeFromCache(key, del.getAttribute("data-d"));
          showDD(inp, key, inp.value);
          return;
        }
        e.preventDefault();
        inp.value = it.getAttribute("data-v");
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        hideDD();
      });
    });
  }

  function hideDD() {
    if (_dd) _dd.style.display = "none";
    _aInp = null; _aKey = null; _fidx = -1;
  }

  // Keyboard nav
  document.addEventListener("keydown", function (e) {
    if (!_dd || _dd.style.display === "none") return;
    var its = _dd.querySelectorAll(".ac-it");
    if (!its.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      _fidx = (_fidx + 1) % its.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _fidx = (_fidx - 1 + its.length) % its.length;
    } else if (e.key === "Enter" && _fidx >= 0) {
      e.preventDefault();
      var v = its[_fidx].getAttribute("data-v");
      if (_aInp) {
        _aInp.value = v;
        _aInp.dispatchEvent(new Event("input", { bubbles: true }));
      }
      hideDD(); return;
    } else if (e.key === "Escape") { hideDD(); return; }
    its.forEach(function (it, i) { it.classList.toggle("hi", i === _fidx); });
    if (its[_fidx]) its[_fidx].scrollIntoView({ block: "nearest" });
  }, true);

  document.addEventListener("mousedown", function (e) {
    if (_dd && !_dd.contains(e.target)) hideDD();
  });

  // ──────────────────────────────────────────────
  //  4. Attach
  // ──────────────────────────────────────────────
  function attach(f) {
    var el = document.getElementById(f.id);
    if (!el || el.dataset.acv3) return;
    el.dataset.acv3 = "1";
    el.setAttribute("autocomplete", "off");

    el.addEventListener("focus", function () {
      if (!_cacheOk) buildFromDB();
      _fidx = -1;
      showDD(el, f.dbKey, el.value);
    });
    el.addEventListener("input", function () {
      _fidx = -1;
      showDD(el, f.dbKey, el.value);
    });
    el.addEventListener("blur", function () {
      setTimeout(hideDD, 160);
    });
  }

  function attachUpper(id) {
    var el = document.getElementById(id);
    if (!el || el.dataset.upv3) return;
    el.dataset.upv3 = "1";
    el.addEventListener("input", function () {
      var p = this.selectionStart;
      this.value = this.value.toUpperCase();
      try { this.setSelectionRange(p, p); } catch(e) {}
    });
  }

  // ──────────────────────────────────────────────
  //  5. Hooks
  // ──────────────────────────────────────────────
  function hookSave() {
    var orig = window.doSave;
    if (!orig || orig._v3) return;
    window.doSave = function () {
      AC_FIELDS.forEach(function (f) {
        var el = document.getElementById(f.id);
        if (el && el.value.trim()) addToCache(f.dbKey, el.value.trim());
      });
      orig.apply(this, arguments);
    };
    window.doSave._v3 = true;
  }

  function hookCloudSync() {
    var orig = window.cloudSync;
    if (!orig || orig._v3) return;
    window.cloudSync = function (cb) {
      orig(function () {
        buildFromDB();
        if (cb) cb();
      });
    };
    window.cloudSync._v3 = true;
  }

  // ──────────────────────────────────────────────
  //  6. Boot
  // ──────────────────────────────────────────────
  function boot() {
    createDD();
    AC_FIELDS.forEach(attach);
    UPPER_IDS.forEach(attachUpper);
    hookSave();
    hookCloudSync();

    if (window.DB && window.DB.length) {
      buildFromDB();
    } else {
      buildFromFirestore(function () {
        AC_FIELDS.forEach(attach);
        UPPER_IDS.forEach(attachUpper);
      });
    }
  }

  var origInit = window.initApp;
  if (origInit) {
    window.initApp = function () {
      origInit.apply(this, arguments);
      setTimeout(function () {
        AC_FIELDS.forEach(attach);
        UPPER_IDS.forEach(attachUpper);
        hookSave();
      }, 1500);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 900); });
  } else {
    setTimeout(boot, 900);
  }

  // Debug
  window.agniAC = {
    cache: function () { return _cache; },
    reload: function () { buildFromFirestore(function () { console.log("reloaded", _cache); }); },
  };

})();
