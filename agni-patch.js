// ══════════════════════════════════════════════════════════
//  AGNI SYSTEMS — Autocomplete + Uppercase Patch
//  এই script টি মূল HTML-এর </body> ট্যাগের আগে যোগ করুন
// ══════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ──────────────────────────────────────────────
  //  1. STORAGE KEY → কোন field-এর data কোথায় থাকবে
  // ──────────────────────────────────────────────
  var AC_STORE_KEY = "agni_ac_data";

  // যে field গুলোতে autocomplete কাজ করবে
  // { inputId, storageKey, label }
  var AC_FIELDS = [
    { id: "fArea",   key: "area",   label: "এলাকা" },
    { id: "fThana",  key: "thana",  label: "থানা"  },
    { id: "fHouse",  key: "house",  label: "বাসা"  },
    { id: "fRem",    key: "remark", label: "মন্তব্য" },
    // Equipment fields
    { id: "eRm",     key: "router_model", label: "রাউটার মডেল" },
    { id: "eTm",     key: "onu_model",    label: "ONU মডেল"    },
    { id: "eROm",    key: "ronu_model",   label: "Replace ONU মডেল" },
  ];

  // ──────────────────────────────────────────────
  //  2. LocalStorage helpers
  // ──────────────────────────────────────────────
  function loadAcData() {
    try { return JSON.parse(localStorage.getItem(AC_STORE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveAcData(data) {
    try { localStorage.setItem(AC_STORE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  // একটি key-তে নতুন value যোগ করুন (duplicate বাদ, max 60)
  function addToStore(key, value) {
    if (!value || value.trim().length < 2) return;
    var val = value.trim();
    var data = loadAcData();
    if (!data[key]) data[key] = [];
    // duplicate remove (case-insensitive)
    data[key] = data[key].filter(function (v) {
      return v.toLowerCase() !== val.toLowerCase();
    });
    data[key].unshift(val); // সবচেয়ে নতুনটা সামনে
    if (data[key].length > 60) data[key] = data[key].slice(0, 60);
    saveAcData(data);
  }

  // query দিয়ে filter
  function getMatches(key, query) {
    var data = loadAcData();
    var list = data[key] || [];
    if (!query || query.trim().length === 0) return list.slice(0, 8);
    var q = query.trim().toLowerCase();
    return list
      .filter(function (v) { return v.toLowerCase().indexOf(q) >= 0; })
      .slice(0, 8);
  }

  // ──────────────────────────────────────────────
  //  3. Dropdown UI
  // ──────────────────────────────────────────────

  // Global dropdown container (একটাই, reuse)
  var _dropdown = null;
  var _activeInput = null;
  var _activeKey = null;

  function createDropdown() {
    if (_dropdown) return;
    _dropdown = document.createElement("div");
    _dropdown.id = "agni_ac_dropdown";
    _dropdown.style.cssText = [
      "position:fixed",
      "z-index:99999",
      "background:#1e293b",
      "border:1px solid rgba(255,255,255,.12)",
      "border-radius:9px",
      "box-shadow:0 8px 32px rgba(0,0,0,.45)",
      "max-height:220px",
      "overflow-y:auto",
      "display:none",
      "min-width:180px",
      "padding:4px 0",
      "font-family:'Hind Siliguri',sans-serif",
    ].join(";");

    // Light mode support
    var style = document.createElement("style");
    style.textContent = [
      "#agni_ac_dropdown { transition: opacity .15s; }",
      ".agni-ac-item {",
      "  padding: 9px 14px;",
      "  font-size: 13px;",
      "  color: rgba(255,255,255,.75);",
      "  cursor: pointer;",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 8px;",
      "  border-bottom: 1px solid rgba(255,255,255,.05);",
      "  transition: background .12s;",
      "}",
      ".agni-ac-item:last-child { border-bottom: none; }",
      ".agni-ac-item:hover, .agni-ac-item.ac-focused {",
      "  background: rgba(22,163,74,.18);",
      "  color: #fff;",
      "}",
      ".agni-ac-item .ac-icon { font-size:11px; opacity:.4; flex-shrink:0; }",
      ".agni-ac-item .ac-text { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
      ".agni-ac-item .ac-del {",
      "  font-size:11px; opacity:.3; padding:2px 5px;",
      "  border-radius:4px; flex-shrink:0;",
      "  transition: opacity .12s, background .12s;",
      "}",
      ".agni-ac-item:hover .ac-del { opacity:.7; }",
      ".agni-ac-item .ac-del:hover { opacity:1!important; background:rgba(220,38,38,.3); color:#fca5a5; }",
      // Light mode overrides
      "body.lg-light #agni_ac_dropdown {",
      "  background: #fff;",
      "  border-color: #e2e8f0;",
      "  box-shadow: 0 8px 32px rgba(0,0,0,.12);",
      "}",
      "body.lg-light .agni-ac-item { color: #334155; border-bottom-color: #f1f5f9; }",
      "body.lg-light .agni-ac-item:hover, body.lg-light .agni-ac-item.ac-focused {",
      "  background: rgba(22,163,74,.08); color: #1e293b;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
    document.body.appendChild(_dropdown);
  }

  function positionDropdown(input) {
    var rect = input.getBoundingClientRect();
    _dropdown.style.top  = (rect.bottom + 3) + "px";
    _dropdown.style.left = rect.left + "px";
    _dropdown.style.width = Math.max(rect.width, 200) + "px";
  }

  function showDropdown(input, key, query) {
    var matches = getMatches(key, query);
    if (!matches.length) { hideDropdown(); return; }

    _activeInput = input;
    _activeKey   = key;

    var html = matches.map(function (val, i) {
      var escaped = val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return '<div class="agni-ac-item" data-val="' + escaped + '" data-idx="' + i + '">'
        + '<span class="ac-icon">↩</span>'
        + '<span class="ac-text">' + escaped + '</span>'
        + '<span class="ac-del" data-del="' + escaped + '" title="মুছুন">✕</span>'
        + '</div>';
    }).join("");

    _dropdown.innerHTML = html;
    _dropdown.style.display = "block";
    positionDropdown(input);

    // Click handlers
    _dropdown.querySelectorAll(".agni-ac-item").forEach(function (item) {
      item.addEventListener("mousedown", function (e) {
        var delBtn = e.target.closest(".ac-del");
        if (delBtn) {
          e.preventDefault();
          e.stopPropagation();
          deleteFromStore(key, delBtn.getAttribute("data-del"));
          showDropdown(input, key, input.value); // refresh
          return;
        }
        e.preventDefault();
        var val = item.getAttribute("data-val");
        input.value = val;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        hideDropdown();
        // next input focus
        setTimeout(function () { input.blur(); }, 50);
      });
    });
  }

  function hideDropdown() {
    if (_dropdown) _dropdown.style.display = "none";
    _activeInput = null;
    _activeKey   = null;
    _focusedIdx  = -1;
  }

  // ──────────────────────────────────────────────
  //  4. Keyboard navigation
  // ──────────────────────────────────────────────
  var _focusedIdx = -1;

  function updateFocus() {
    if (!_dropdown || _dropdown.style.display === "none") return;
    var items = _dropdown.querySelectorAll(".agni-ac-item");
    items.forEach(function (it, i) {
      if (i === _focusedIdx) it.classList.add("ac-focused");
      else it.classList.remove("ac-focused");
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!_dropdown || _dropdown.style.display === "none") return;
    var items = _dropdown.querySelectorAll(".agni-ac-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      _focusedIdx = (_focusedIdx + 1) % items.length;
      updateFocus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _focusedIdx = (_focusedIdx - 1 + items.length) % items.length;
      updateFocus();
    } else if (e.key === "Enter") {
      if (_focusedIdx >= 0 && items[_focusedIdx]) {
        e.preventDefault();
        var val = items[_focusedIdx].getAttribute("data-val");
        if (_activeInput) {
          _activeInput.value = val;
          _activeInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        hideDropdown();
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  }, true);

  // click outside → hide
  document.addEventListener("mousedown", function (e) {
    if (_dropdown && !_dropdown.contains(e.target)) hideDropdown();
  });

  // scroll/resize → reposition
  window.addEventListener("scroll", function () {
    if (_activeInput && _dropdown && _dropdown.style.display !== "none")
      positionDropdown(_activeInput);
  }, true);
  window.addEventListener("resize", function () {
    if (_activeInput && _dropdown && _dropdown.style.display !== "none")
      positionDropdown(_activeInput);
  });

  // ──────────────────────────────────────────────
  //  5. Delete from store
  // ──────────────────────────────────────────────
  function deleteFromStore(key, value) {
    var data = loadAcData();
    if (!data[key]) return;
    data[key] = data[key].filter(function (v) {
      return v.toLowerCase() !== value.toLowerCase();
    });
    saveAcData(data);
  }

  // ──────────────────────────────────────────────
  //  6. Attach autocomplete to fields
  // ──────────────────────────────────────────────
  function attachAC(fieldDef) {
    var el = document.getElementById(fieldDef.id);
    if (!el) return;

    // prevent double-attach
    if (el.dataset.acAttached) return;
    el.dataset.acAttached = "1";

    el.setAttribute("autocomplete", "off");

    el.addEventListener("input", function () {
      _focusedIdx = -1;
      showDropdown(el, fieldDef.key, el.value);
    });

    el.addEventListener("focus", function () {
      _focusedIdx = -1;
      showDropdown(el, fieldDef.key, el.value);
    });

    el.addEventListener("blur", function () {
      // blur এর আগে mousedown handler চলে, তাই delay দিই
      setTimeout(hideDropdown, 200);
    });
  }

  // ──────────────────────────────────────────────
  //  7. Save values when doSave() is called
  //     → মূল doSave কে wrap করি
  // ──────────────────────────────────────────────
  function hookSave() {
    var origSave = window.doSave;
    if (!origSave || origSave._acHooked) return;

    window.doSave = function () {
      // Save করার আগে current field values store করো
      AC_FIELDS.forEach(function (f) {
        var el = document.getElementById(f.id);
        if (el && el.value.trim()) addToStore(f.key, el.value.trim());
      });
      // মূল save চালাও
      origSave.apply(this, arguments);
    };
    window.doSave._acHooked = true;
  }

  // ──────────────────────────────────────────────
  //  8. Uppercase for মডেল/serial fields
  //     (রাউটার, ONU, TJ Box, Replace ONU serial)
  // ──────────────────────────────────────────────
  var UPPER_IDS = [
    "eRm","eRs",          // Router model, serial
    "eC1s","eC2s",        // Cable serials
    "eTm","eOs",          // ONU model, serial
    "eTs","eTsSerial",    // TJ serial
    "eTsB",               // TJ B serial
    "eROm","eROs",        // Replace ONU model, serial
    "eSs",                // Splitter serial
  ];

  function attachUppercase(id) {
    var el = document.getElementById(id);
    if (!el || el.dataset.upperAttached) return;
    el.dataset.upperAttached = "1";
    el.addEventListener("input", function () {
      var pos = this.selectionStart;
      this.value = this.value.toUpperCase();
      try { this.setSelectionRange(pos, pos); } catch(e) {}
    });
  }

  // ──────────────────────────────────────────────
  //  9. Bootstrap — DOM ready হলে attach করো
  // ──────────────────────────────────────────────
  function bootstrap() {
    createDropdown();

    AC_FIELDS.forEach(attachAC);
    UPPER_IDS.forEach(attachUppercase);
    hookSave();
  }

  // DOMContentLoaded বা পরে load হলে
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      // App load হওয়ার পর initApp ও call হয়, তাই একটু delay
      setTimeout(bootstrap, 800);
    });
  } else {
    setTimeout(bootstrap, 800);
  }

  // initApp এর পরেও re-attach (Firebase sync শেষে fields recreate হলে)
  var _origInitApp = window.initApp;
  if (_origInitApp) {
    window.initApp = function () {
      _origInitApp.apply(this, arguments);
      setTimeout(bootstrap, 1200);
    };
  }

  // ──────────────────────────────────────────────
  // 10. Public utility (optional, debug থেকে call করতে পারবেন)
  // ──────────────────────────────────────────────
  window.agniAC = {
    getAll: loadAcData,
    clear: function (key) {
      var data = loadAcData();
      if (key) { delete data[key]; } else { data = {}; }
      saveAcData(data);
      console.log("AC store cleared:", key || "all");
    },
  };

})();
