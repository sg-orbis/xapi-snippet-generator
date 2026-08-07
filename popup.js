"use strict";
(function () {
  var openBtn = document.getElementById("openBtn");
  var statusEl = document.getElementById("status");

  function setStatus(msg) { statusEl.textContent = msg || ""; }

  function isRiseAuthoring(url) {
    try {
      var u = new URL(url);
      return u.hostname === "rise.articulate.com" && u.pathname.indexOf("/share/") !== 0;
    } catch (e) { return false; }
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !isRiseAuthoring(tab.url)) {
      openBtn.disabled = true;
      setStatus("This works inside a Rise course you're editing. Open one on rise.articulate.com, then come back.");
    }
  });

  openBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) { setStatus("No active tab to open into."); return; }
      chrome.tabs.sendMessage(tab.id, { type: "xag-open-panel" }, function (resp) {
        if (chrome.runtime.lastError) {
          setStatus("Reload the Rise page once, then try again \u2014 the extension needs a fresh page to attach to.");
          return;
        }
        if (resp && resp.ok) {
          window.close();
        } else {
          setStatus("This page isn't a Rise course in edit mode.");
        }
      });
    });
  });
})();
