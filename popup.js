"use strict";
(function () {
  var openBtn = document.getElementById("openBtn");
  var status = document.getElementById("status");

  function setStatus(msg) { status.textContent = msg || ""; }

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
      setStatus("Open a Rise course (rise.articulate.com) in edit mode, then click here.");
    }
  });

  openBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) { setStatus("No active tab."); return; }
      chrome.tabs.sendMessage(tab.id, { type: "xag-open-panel" }, function (resp) {
        if (chrome.runtime.lastError) {
          setStatus("Reload the Rise page once, then try again.");
          return;
        }
        if (resp && resp.ok) {
          setStatus("Opened. Look for the panel on the right.");
          window.close();
        } else {
          setStatus("This isn't a Rise authoring page.");
        }
      });
    });
  });
})();
