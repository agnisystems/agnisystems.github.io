// ══════════════════════════════════════════════════════════
//  AGNI SYSTEMS — Firebase-based Autocomplete + Uppercase
//  </body> ট্যাগের আগে যোগ করুন:
//  <script src="agni-patch-v2.js"></script>
// ══════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ──────────────────────────────────────────────
  //  1. Firebase থেকে যে field গুলোর unique value নেব
  //     fieldKey → Firestore document-এর field name
  // ──────────────────────────────────────────────
  var AC_FIELDS = [
    { id: "fArea",  dbKey: "area",          label: "এলাকা"         },
    { id: "fThana", dbKey: "thana",         label: "থানা"           },
    { id: "fHouse", dbKey: "house",         label: "বাসা"           },
    { id: "fRem",   dbKey: "remark",        label: "মন্তব্য"        },
    { id: "eRm",    dbKey: "eRm",           label: "রাউটার মডেল"   },
    { id: "eTm",    dbKey: "eTm",           label: "ONU মডেল"       },
    { id: "eROm",   dbKey: "eROm",          label: "Replace ONU"   },
  ];

  // Uppercase হবে এই field গুলো
  var UPPER_IDS = [
    "eRm","eRs","eC1s","eC2s",
    "eTm","eOs","eTs","eTsSerial",
    "eTsB","eROm","eROs","eSs",
  ];

  // ──────────────────────────────────────────────
  //  2. In-memory cache: { dbKey: [val1, val2, ...] }
  // ──────────────────────────────────────────────
  var _cache = {};
  var _cacheReady = false;

  // Firebase DB — মূল কোডের fsdb ব্যবহার করব
  function getDb() { return window.fsdb || null; }

  // DB array (মূল কোডের) থেকে সরাসরি unique values তুলি
  function buildCacheFromDB() {
    var db = window.DB;
    if (!db || !db.length) return;
    _cache = {};
    AC_FIELDS.forEach(function (f) {
      var seen = {};
      var vals = [];
      for (var i = db.length - 1; i >= 0; i--) { // নতুন → পুরনো
        var v = (db[i][f.dbKey] || "").trim();
        if (v.length >= 2 && !seen[v.toLowerCase()]) {
          seen[v.toLowerCase()] = 1;
          vals.push(v);
        }
      }
      _cache[f.dbKey] = vals;
    });
    _cacheReady = true;
  }

  // Firestore থেকে live fetch (DB array খালি থাকলে fallback)
  function buildCacheFromFirestore(cb) {
    var db = getDb();
    if (!db) { if (cb) cb(); return; }
    db.collection("customers").get().then(function (snap) {
      _cache = {};
      AC_FIELDS.forEach(function (f) {
        var seen = {};
        var vals = [];
        var docs = [];
        snap.forEach(function (d) { docs.push(d.data()); });
        // নতুন রেকর্ড আগে (id desc)
        docs.sort(function (a, b) {
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        docs.forEach(function (rec) {
          var v = (rec[f.dbKey] || "").trim();
          if (v.length >= 2 && !seen[v.toLowerCase()]) {
            seen[v.toLowerCase()] = 1;
            vals.push(v);
          }
        });
        _cache[f.dbKey] = vals;
      });
      _cacheReady = true;
      if (cb) cb();
    }).catch(function () { if (cb) cb(); });
  }

  // Query match
  function getMatches(dbKey, query) {
    var list = _cache[dbKey] || [];
    if (!query || query.trim().length === 0) return list.slice(0, 8);
    var q = query.trim().toLowerCase();
    return list
      .filter(function (v) { return v.toLowerCase().indexOf(q) >= 0; })
      .slice(0, 8);
  }

  // নতুন save হলে cache-এ add করো
  function addToCache(dbKey, value) {
    if (!value || value.trim().length < 2) return;
    var val = value.trim();
    if (!_cache[dbKey]) _cache[dbKey] = [];
    _cache[dbKey] = _cache[dbKey].filter(function (v) {
      return v.toLowerCase() !== val.toLowerCase();
    });
    _cache[dbKey].unshift(val);
  }

  // ──────────────────────────────────────────────
  //  3. Dropdown UI
  // ──────────────────────────────────────────────
  var _dropdown = null;
  var _activeInput = null;
  var _activeKey = null;
  var _focusedIdx = -1;

  function injectStyles() {
    if (document.getElementById("agni_ac_style")) return;
    var s = document.createElement("style");
    s.id = "agni_ac_style";
    s.textContent = [
      "#agni_ac_dd {",
      "  position:fixed; z-index:99999;",
      "  background:#1e293b;",
      "  border:1px solid rgba(255,255,255,.13);",
      "  border-radius:10px;",
      "  box-shadow:0 10px 36px rgba(0,0,0,.5);",
      "  max-height:230px; overflow-y:auto;",
      "  display:none; min-width:180px; padding:4px 0;",
      "  font-family:'Hind Siliguri',sans-serif;",
      "}",
      "#agni_ac_dd::-webkit-scrollbar{width:4px;}",
      "#agni_ac_dd::-webkit-scrollbar-track{background:transparent;}",
      "#agni_ac_dd::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px;}",
      ".ac-item {",
      "  padding:9px 13px; font-size:13px;",
      "  color:rgba(255,255,255,.8); cursor:pointer;",
      "  display:flex; align-items:center; gap:9px;",
      "  border-bottom:1px solid rgba(255,255,255,.05);",
      "  transition:background .1s;",
      "}",
      ".ac-item:last-child{border-bottom:none;}",
      ".ac-item:hover,.ac-item.ac-hi{background:rgba(22,163,74,.18);color:#fff;}",
      ".ac-ico{font-size:11px;opacity:.35;flex-shrink:0;}",
      ".ac-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".ac-x{font-size:11px;opacity:0;padding:1px 6px;border-radius:4px;",
      "       flex-shrink:0;transition:opacity .12s,background .12s;color:#f87171;}",
      ".ac-item:hover .ac-x{opacity:.6;}",
      ".ac-x:hover{opacity:1!important;background:rgba(220,38,38,.25);}",
      // light mode
      "body.lg-light #agni_ac_dd{",
      "  background:#fff;border-color:#e2e8f0;",
      "  box-shadow:0 10px 36px rgba(0,0,0,.13);",
      "}",
      "body.lg-light .ac-item{color:#334155;border-bottom-color:#f1f5f9;}",
      "body.lg-light .ac-item:hover,body.lg-light .ac-item.ac-hi{",
      "  background:rgba(22,163,74,.09);color:#1e293b;",
      "}",
      "body.lg-light .ac-x{color:#dc2626;}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function createDropdown() {
    if (_dropdown) return;
    injectStyles();
    _dropdown = document.createElement("div");
    _dropdown.id = "agni_ac_dd";
    document.body.appendChild(_dropdown);
  }

  function positionDD(input) {
    var r = input.getBoundingClientRect();
    _dropdown.style.top  = (r.bottom + window.scrollY + 3) + "px";
    _dropdown.style.left = r.left + "px";
    _dropdown.style.width = Math.max(r.width, 210) + "px";
    // viewport থেকে বেরিয়ে গেলে উপরে দেখাও
    var ddH = Math.min(230, 40 * 8);
    if (r.bottom + ddH > window.innerHeight) {
      _dropdown.style.top = (r.top + window.scrollY - ddH - 4) + "px";
    }
  }

  function renderDD(input, dbKey, query) {
    var matches = getMatches(dbKey, query);
    if (!matches.length) { hideDD(); return; }

    _activeInput = input;
    _activeKey   = dbKey;
    _focusedIdx  = -1;

    _dropdown.innerHTML = matches.map(function (val, i) {
      var esc = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return '<div class="ac-item" data-val="' + esc + '" data-i="' + i + '">'
        + '<span class="ac-ico">↩</span>'
        + '<span class="ac-txt">' + esc + '</span>'
        + '<span class="ac-x" data-del="' + esc + '" title="Cache থেকে মুছুন">✕</span>'
        + '</div>';
    }).join("");

    _dropdown.style.display = "block";
    positionDD(input);

    _dropdown.querySelectorAll(".ac-item").forEach(function (item) {
      item.addEventListener("mousedown", function (e) {
        var del = e.target.closest(".ac-x");
        if (del) {
          e.preventDefault(); e.stopPropagation();
          removeFromCache(dbKey, del.getAttribute("data-del"));
          renderDD(input, dbKey, input.value);
          return;
        }
        e.preventDefault();
        input.value = item.getAttribute("data-val");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        hideDD();
      });
    });
  }

  function hideDD() {
    if (_dropdown) _dropdown.style.display = "none";
    _activeInput = null; _activeKey = null; _focusedIdx = -1;
  }

  function removeFromCache(dbKey, val) {
    if (!_cache[dbKey]) return;
    _cache[dbKey] = _cache[dbKey].filter(function (v) {
      return v.toLowerCase() !== val.toLowerCase();
    });
  }

  // Keyboard nav
  document.addEventListener("keydown", function (e) {
    if (!_dropdown || _dropdown.style.display === "none") return;
    var items = _dropdown.querySelectorAll(".ac-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      _focusedIdx = (_focusedIdx + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _focusedIdx = (_focusedIdx - 1 + items.length) % items.length;
    } else if (e.key === "Enter" && _focusedIdx >= 0) {
      e.preventDefault();
      var val = items[_focusedIdx].getAttribute("data-val");
      if (_activeInput) {
        _activeInput.value = val;
        _activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      hideDD(); return;
    } else if (e.key === "Escape") { hideDD(); return; }
    items.forEach(function (it, i) {
      it.classList.toggle("ac-hi", i === _focusedIdx);
    });
    if (items[_focusedIdx]) items[_focusedIdx].scrollIntoView({ block: "nearest" });
  }, true);

  document.addEventListener("mousedown", function (e) {
    if (_dropdown && !_dropdown.contains(e.target)) hideDD();
  });
  window.addEventListener("scroll", function () {
    if (_activeInput && _dropdown && _dropdown.style.display !== "none")
      positionDD(_activeInput);
  }, true);
  window.addEventListener("resize", function () {
    if (_activeInput && _dropdown && _dropdown.style.display !== "none")
      positionDD(_activeInput);
  });

  // ──────────────────────────────────────────────
  //  4. Attach autocomplete to a field
  // ──────────────────────────────────────────────
  function attach(fieldDef) {
    var el = document.getElementById(fieldDef.id);
    if (!el || el.dataset.acOk) return;
    el.dataset.acOk = "1";
    el.setAttribute("autocomplete", "off");

    el.addEventListener("focus", function () {
      if (!_cacheReady) buildCacheFromDB();
      _focusedIdx = -1;
      renderDD(el, fieldDef.dbKey, el.value);
    });
    el.addEventListener("input", function () {
      _focusedIdx = -1;
      renderDD(el, fieldDef.dbKey, el.value);
    });
    el.addEventListener("blur", function () {
      setTimeout(hideDD, 180);
    });
  }

  // ──────────────────────────────────────────────
  //  5. Uppercase attach
  // ──────────────────────────────────────────────
  function attachUpper(id) {
    var el = document.getElementById(id);
    if (!el || el.dataset.upOk) return;
    el.dataset.upOk = "1";
    el.addEventListener("input", function () {
      var pos = this.selectionStart;
      this.value = this.value.toUpperCase();
      try { this.setSelectionRange(pos, pos); } catch (e) {}
    });
  }

  // ──────────────────────────────────────────────
  //  6. Hook doSave → cache update
  // ──────────────────────────────────────────────
  function hookSave() {
    var orig = window.doSave;
    if (!orig || orig._v2) return;
    window.doSave = function () {
      AC_FIELDS.forEach(function (f) {
        var el = document.getElementById(f.id);
        if (el && el.value.trim()) addToCache(f.dbKey, el.value.trim());
      });
      orig.apply(this, arguments);
    };
    window.doSave._v2 = true;
  }

  // ──────────────────────────────────────────────
  //  7. Bootstrap
  // ──────────────────────────────────────────────
  function boot() {
    createDropdown();
    AC_FIELDS.forEach(attach);
    UPPER_IDS.forEach(attachUpper);
    hookSave();

    // DB array থেকে cache তৈরি
    if (window.DB && window.DB.length) {
      buildCacheFromDB();
    } else {
      // DB এখনো লোড হয়নি → Firestore থেকে নাও
      buildCacheFromFirestore(function () {
        // Firestore শেষ হলে আবার attach (fields হয়তো তখন ready)
        AC_FIELDS.forEach(attach);
        UPPER_IDS.forEach(attachUpper);
      });
    }
  }

  // cloudSync শেষে cache refresh
  var origCloudSync = window.cloudSync;
  if (origCloudSync) {
    window.cloudSync = function (cb) {
      origCloudSync(function () {
        buildCacheFromDB();
        if (cb) cb();
      });
    };
  }

  // initApp hook
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

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 900); });
  } else {
    setTimeout(boot, 900);
  }

  // Public debug helper
  window.agniAC = {
    cache: function () { return _cache; },
    reload: function () { buildCacheFromFirestore(function () { console.log("AC cache reloaded", _cache); }); },
    reloadFromDB: function () { buildCacheFromDB(); console.log("AC cache from DB", _cache); },
  };

})();
