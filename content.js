/*
 * Content script — injects the dock toggle and the panel iframe into the
 * Articulate Rise authoring app.
 *
 * v3 changes:
 *   - The dock is non-modal. The backdrop is gone, so the Rise editor stays
 *     interactive and you can paste into a code block with the panel open.
 *   - The dock is resizable by dragging its left edge; the width persists.
 *   - The toggle both opens and closes, and slides clear of the dock rather
 *     than disappearing.
 *
 * We deliberately do NOT run on /share/ URLs — those are preview and
 * published review links, not the authoring editor.
 */
(function () {
  "use strict";

  var WIDTH_KEY = "xag-dock-width-v1";
  var MIN_W = 380;
  var MAX_FRACTION = 0.92;

  var toggle = null;
  var dock = null;
  var frame = null;
  var grip = null;
  var capture = null;
  var mounted = false;
  var isOpen = false;

  var hasStorage = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);

  /* ----------------------------- eligibility ----------------------------- */

  function isAuthoringPage() {
    if (location.hostname !== "rise.articulate.com") return false;
    if (location.pathname.indexOf("/share/") === 0) return false;
    return true;
  }

  /* -------------------------------- width -------------------------------- */

  function maxWidth() {
    return Math.round(window.innerWidth * MAX_FRACTION);
  }

  function clampWidth(px) {
    var max = Math.max(MIN_W, maxWidth());
    return Math.min(max, Math.max(MIN_W, Math.round(px)));
  }

  function applyWidth(px) {
    document.documentElement.style.setProperty("--xag-dock-w", clampWidth(px) + "px");
  }

  function saveWidth(px) {
    if (!hasStorage) return;
    var p = {};
    p[WIDTH_KEY] = clampWidth(px);
    try { chrome.storage.local.set(p); } catch (e) {}
  }

  function restoreWidth() {
    if (!hasStorage) return;
    try {
      chrome.storage.local.get(WIDTH_KEY, function (res) {
        var w = res && res[WIDTH_KEY];
        if (typeof w === "number" && w > 0) applyWidth(w);
      });
    } catch (e) {}
  }

  /* -------------------------------- build -------------------------------- */

  var ICON =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2.6 13.4 8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '<path d="M8 8h5.4M8 8V2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '<circle cx="2.9" cy="13.1" r="1.6" fill="currentColor"/>' +
    '</svg>';

  function buildUI() {
    if (mounted) return;
    mounted = true;

    dock = document.createElement("div");
    dock.id = "xag-dock";

    frame = document.createElement("iframe");
    frame.id = "xag-frame";
    frame.setAttribute("title", "xAPI Snippet Generator");
    // Permissions-Policy delegation so navigator.clipboard works in the frame.
    frame.setAttribute("allow", "clipboard-write");
    frame.src = chrome.runtime.getURL("panel.html");

    grip = document.createElement("button");
    grip.id = "xag-grip";
    grip.type = "button";
    grip.setAttribute("aria-label", "Resize panel — use left and right arrow keys");

    dock.appendChild(grip);
    dock.appendChild(frame);

    toggle = document.createElement("button");
    toggle.id = "xag-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      ICON +
      '<span class="xag-label-open">xAPI snippet</span>' +
      '<span class="xag-label-close">Hide panel</span>';

    toggle.addEventListener("click", function () {
      if (isOpen) closePanel(); else openPanel();
    });

    wireResize();

    document.body.appendChild(dock);
    document.body.appendChild(toggle);

    restoreWidth();
  }

  /* ------------------------------ open / close --------------------------- */

  function openPanel() {
    if (!mounted) buildUI();
    isOpen = true;
    dock.classList.add("xag-open");
    toggle.classList.add("xag-shifted");
    toggle.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    if (!mounted) return;
    isOpen = false;
    dock.classList.remove("xag-open");
    toggle.classList.remove("xag-shifted");
    toggle.setAttribute("aria-expanded", "false");
  }

  /* -------------------------------- resize ------------------------------- */

  function wireResize() {
    var startX = 0;
    var startW = 0;

    function onMove(e) {
      // Dock is anchored right, so dragging left grows it.
      applyWidth(startW + (startX - e.clientX));
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (capture && capture.parentNode) capture.parentNode.removeChild(capture);
      capture = null;
      dock.classList.remove("xag-resizing");
      saveWidth(dock.getBoundingClientRect().width);
    }

    grip.addEventListener("mousedown", function (e) {
      e.preventDefault();
      startX = e.clientX;
      startW = dock.getBoundingClientRect().width;
      dock.classList.add("xag-resizing");

      // Capture layer keeps mousemove alive as the cursor passes the iframe.
      capture = document.createElement("div");
      capture.id = "xag-capture";
      document.body.appendChild(capture);

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    grip.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 60 : 20;
      var w = dock.getBoundingClientRect().width;
      if (e.key === "ArrowLeft") { applyWidth(w + step); saveWidth(w + step); e.preventDefault(); }
      if (e.key === "ArrowRight") { applyWidth(w - step); saveWidth(w - step); e.preventDefault(); }
    });

    window.addEventListener("resize", function () {
      applyWidth(dock.getBoundingClientRect().width);
    });
  }

  /* ------------------------------- messaging ----------------------------- */

  // The panel asks the host to close it, or reports a copy for a host toast.
  window.addEventListener("message", function (e) {
    if (!e || !e.data || e.data.source !== "xag-panel") return;
    if (e.data.type === "close") closePanel();
  });

  // The toolbar popup can ask us to open on the active tab.
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "xag-open-panel") {
      if (isAuthoringPage()) {
        openPanel();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, reason: "not-authoring" });
      }
    }
    return true;
  });

  /* --------------------------------- mount ------------------------------- */

  function mountIfEligible() {
    if (isAuthoringPage()) {
      buildUI();
    } else if (mounted) {
      // Navigated to a share/preview route — stand down.
      closePanel();
    }
  }

  // Rise is a single-page app, so watch client-side navigation too.
  function hookHistory() {
    ["pushState", "replaceState"].forEach(function (fn) {
      var orig = history[fn];
      history[fn] = function () {
        var r = orig.apply(this, arguments);
        window.dispatchEvent(new Event("xag-locationchange"));
        return r;
      };
    });
    window.addEventListener("popstate", function () {
      window.dispatchEvent(new Event("xag-locationchange"));
    });
    window.addEventListener("hashchange", function () {
      window.dispatchEvent(new Event("xag-locationchange"));
    });
    window.addEventListener("xag-locationchange", mountIfEligible);
  }

  // Rise re-renders can drop our nodes. Re-attach them, but throttle the
  // check — this observer fires constantly on a heavy SPA.
  var reattachQueued = false;
  var observer = new MutationObserver(function () {
    if (!mounted || reattachQueued) return;
    reattachQueued = true;
    requestAnimationFrame(function () {
      reattachQueued = false;
      if (!isAuthoringPage()) return;
      if (dock && !dock.isConnected) document.body.appendChild(dock);
      if (toggle && !toggle.isConnected) document.body.appendChild(toggle);
    });
  });

  function start() {
    hookHistory();
    mountIfEligible();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
