/*
 * Content script: injects a floating "xAPI" button into the Rise authoring
 * tool (edit mode). Clicking it slides in a panel (iframe -> panel.html) that
 * generates the xAPI snippet to paste into a Rise Embed > Code block.
 *
 * We deliberately DO NOT run on /share/ URLs (those are preview / published
 * review links, not the authoring editor).
 */
(function () {
  "use strict";

  // Only inject inside the authoring app, never on shared/preview links.
  function isAuthoringPage() {
    if (location.hostname !== "rise.articulate.com") return false;
    if (location.pathname.indexOf("/share/") === 0) return false;
    return true;
  }

  var fab, panel, backdrop, mounted = false;

  function buildUI() {
    if (mounted) return;
    mounted = true;

    backdrop = document.createElement("div");
    backdrop.id = "xag-backdrop";

    panel = document.createElement("iframe");
    panel.id = "xag-panel";
    panel.setAttribute("title", "xAPI Snippet Generator");
    // Permissions-Policy delegation so navigator.clipboard works inside the frame.
    panel.setAttribute("allow", "clipboard-write");
    panel.src = chrome.runtime.getURL("panel.html");

    fab = document.createElement("button");
    fab.id = "xag-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open xAPI snippet generator");
    fab.innerHTML =
      '<span class="xag-dot"></span><span>xAPI snippet</span>';

    fab.addEventListener("click", openPanel);
    backdrop.addEventListener("click", closePanel);

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.appendChild(fab);
  }

  function openPanel() {
    if (!mounted) buildUI();
    panel.classList.add("xag-open");
    backdrop.classList.add("xag-open");
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove("xag-open");
    backdrop.classList.remove("xag-open");
  }

  // The panel (iframe) asks the host to close it via postMessage.
  window.addEventListener("message", function (e) {
    if (!e || !e.data || e.data.source !== "xag-panel") return;
    if (e.data.type === "close") closePanel();
  });

  // Toolbar popup can request that we open the panel on the active tab.
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

  function mountIfEligible() {
    if (isAuthoringPage()) {
      buildUI();
    }
  }

  // Rise is a single-page app: re-check on client-side navigations and keep
  // the button alive if the app re-renders and drops it from the DOM.
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

  var observer = new MutationObserver(function () {
    if (mounted && isAuthoringPage() && !document.getElementById("xag-fab")) {
      // App wiped our nodes on a re-render; re-attach them.
      if (backdrop && !backdrop.isConnected) document.body.appendChild(backdrop);
      if (panel && !panel.isConnected) document.body.appendChild(panel);
      if (fab && !fab.isConnected) document.body.appendChild(fab);
    }
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
