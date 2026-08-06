"use strict";
(function () {
  var VERBS = {
    experienced: "http://adlnet.gov/expapi/verbs/experienced",
    launched:    "http://adlnet.gov/expapi/verbs/launched",
    initialized: "http://adlnet.gov/expapi/verbs/initialized",
    attempted:   "http://adlnet.gov/expapi/verbs/attempted",
    progressed:  "http://adlnet.gov/expapi/verbs/progressed",
    viewed:      "https://w3id.org/xapi/dod-isd/verbs/viewed",
    interacted:  "http://adlnet.gov/expapi/verbs/interacted",
    answered:    "http://adlnet.gov/expapi/verbs/answered",
    completed:   "http://adlnet.gov/expapi/verbs/completed",
    passed:      "http://adlnet.gov/expapi/verbs/passed",
    failed:      "http://adlnet.gov/expapi/verbs/failed"
  };

  var STORAGE_KEY = "xag-config-v1";
  var hasStorage = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);

  var $ = function (id) { return document.getElementById(id); };
  var form = $("cfg");
  var els = {
    endpoint: $("endpoint"),
    authKey: $("authKey"), authSecret: $("authSecret"), authToken: $("authToken"),
    basicFields: $("basicFields"), bearerFields: $("bearerFields"),
    proxyUrl: $("proxyUrl"), proxyFields: $("proxyFields"), directFields: $("directFields"),
    actorStaticFields: $("actorStaticFields"), actorLaunchHint: $("actorLaunchHint"), actorNameReq: $("actorNameReq"),
    actorName: $("actorName"), actorEmail: $("actorEmail"),
    verbPreset: $("verbPreset"), verbCustomFields: $("verbCustomFields"),
    verbId: $("verbId"), verbDisplay: $("verbDisplay"), verbIriHint: $("verbIriHint"),
    objectId: $("objectId"), objectName: $("objectName"), objectType: $("objectType"), objectDesc: $("objectDesc"),
    optDomain: $("optDomain"), domainFields: $("domainFields"),
    allowedDomains: $("allowedDomains"), optStrictDomain: $("optStrictDomain"),
    optOnce: $("optOnce"), optResult: $("optResult"), resultFields: $("resultFields"),
    resCompletion: $("resCompletion"), resSuccess: $("resSuccess"), resScore: $("resScore"),
    optDebug: $("optDebug"),
    snippetOut: $("snippetOut"), snippetRaw: $("snippetRaw"),
    statusLine: $("statusLine"), copyBtn: $("copyBtn"), downloadBtn: $("downloadBtn"), resetBtn: $("resetBtn"),
    closeBtn: $("closeBtn")
  };

  // ---- fields we persist (id -> "value" | "checked") ----
  var PERSIST = {
    endpoint: "value", authKey: "value", authSecret: "value", authToken: "value",
    proxyUrl: "value",
    actorName: "value", actorEmail: "value",
    verbPreset: "value", verbId: "value", verbDisplay: "value",
    objectId: "value", objectName: "value", objectType: "value", objectDesc: "value",
    optDomain: "checked", allowedDomains: "value", optStrictDomain: "checked",
    optOnce: "checked", optResult: "checked", resCompletion: "checked",
    resSuccess: "checked", resScore: "value", optDebug: "checked"
  };
  var PERSIST_RADIOS = ["authType", "actorSource", "connMode"];

  function radioVal(name) {
    var r = form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : null;
  }
  function setRadio(name, value) {
    var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  function homepageFromIri(iri) {
    if (!iri) return "http://example.org";
    var m = /^(https?:\/\/[^\/]+)/i.exec(iri);
    return m ? m[1] : "http://example.org";
  }
  function b64(str) {
    try { return btoa(unescape(encodeURIComponent(str))); }
    catch (e) { return btoa(str); }
  }

  function buildModel() {
    var connMode = radioVal("connMode");
    var authType = radioVal("authType");
    var auth;
    if (authType === "bearer") {
      var tok = els.authToken.value.trim();
      // Accept either a raw token or a full "Bearer x" / "JWT x" header value.
      auth = /^(bearer|jwt)\s+/i.test(tok) ? tok : ("Bearer " + (tok || "YOUR_TOKEN"));
    } else {
      auth = "Basic " + b64((els.authKey.value || "KEY") + ":" + (els.authSecret.value || "SECRET"));
    }

    var verbKey = els.verbPreset.value;
    var verb;
    if (verbKey === "__custom") {
      verb = { id: els.verbId.value || "https://example.org/verbs/custom",
               display: { "en-US": els.verbDisplay.value || "custom" } };
    } else {
      verb = { id: VERBS[verbKey], display: { "en-US": verbKey } };
    }

    var objDef = {};
    if (els.objectType.value) objDef.type = els.objectType.value;
    objDef.name = { "en-US": els.objectName.value || "Untitled activity" };
    if (els.objectDesc.value) objDef.description = { "en-US": els.objectDesc.value };

    var object = { id: els.objectId.value || "https://example.org/xapi/activity", definition: objDef };

    var fallbackName = els.actorName.value || "Anonymous Learner";
    var fallbackActor = els.actorEmail.value
      ? { name: fallbackName, mbox: "mailto:" + els.actorEmail.value }
      : { name: fallbackName, account: { homePage: homepageFromIri(els.objectId.value), name: fallbackName } };

    var result = null;
    if (els.optResult.checked) {
      result = {};
      if (els.resCompletion.checked) result.completion = true;
      if (els.resSuccess.checked) result.success = true;
      var s = parseFloat(els.resScore.value);
      if (!isNaN(s)) result.score = { scaled: Math.max(0, Math.min(1, s)) };
    }

    var allowedDomains = [];
    if (els.optDomain.checked) {
      allowedDomains = els.allowedDomains.value
        .split(/[\n,;\s]+/)
        .map(function (x) { return x.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""); })
        .filter(function (x) { return x.length > 0; });
    }

    var isProxy = connMode === "proxy";
    // In proxy mode the worker owns the credential, so the snippet carries none
    // and posts the statement straight to the worker URL.
    var endpoint = isProxy
      ? (els.proxyUrl.value || "https://your-worker.workers.dev")
      : (els.endpoint.value || "https://your-lrs.example.com/xapi/");

    return {
      endpoint: endpoint,
      proxyMode: isProxy,
      version: "1.0.3",
      auth: isProxy ? null : auth,
      actorSource: radioVal("actorSource"),
      fallbackActor: fallbackActor,
      verb: verb,
      object: object,
      result: result,
      onceKey: els.optOnce.checked ? ("xapi-sent:" + verb.id + ":" + object.id) : null,
      allowedDomains: allowedDomains,
      strictDomain: els.optStrictDomain.checked,
      debug: els.optDebug.checked
    };
  }

  // The snippet body lives in snippet-template.txt so it stays readable and
  // testable; we only inject the CONFIG object.
  var SNIPPET_TEMPLATE = "";

  function loadTemplate(done) {
    try {
      fetch(chrome.runtime.getURL("snippet-template.txt"))
        .then(function (r) { return r.text(); })
        .then(function (t) { SNIPPET_TEMPLATE = t; done(); },
              function () { done(); });
    } catch (e) { done(); }
  }

  function buildSnippet(m) {
    var cfg = {
      endpoint: m.endpoint, proxyMode: m.proxyMode, version: m.version, auth: m.auth,
      actorSource: m.actorSource, fallbackActor: m.fallbackActor,
      verb: m.verb, object: m.object, result: m.result,
      onceKey: m.onceKey,
      allowedDomains: m.allowedDomains, strictDomain: m.strictDomain,
      debug: m.debug
    };
    var cfgJson = JSON.stringify(cfg, null, 2).replace(/\n/g, "\n  ");
    if (!SNIPPET_TEMPLATE) { return "Loading\u2026"; }
    return SNIPPET_TEMPLATE.replace("__XAPI_CONFIG__", function () { return cfgJson; });
  }

  function setStatus(msg, kind) {
    els.statusLine.textContent = msg || "";
    els.statusLine.className = "status-line" + (kind ? " " + kind : "");
  }

  var lastSnippet = "";

  function regenerate() {
    var connMode = radioVal("connMode");
    var isProxy = connMode === "proxy";
    els.proxyFields.hidden = !isProxy;
    els.directFields.hidden = isProxy;

    var authType = radioVal("authType");
    els.basicFields.hidden = authType !== "basic";
    els.bearerFields.hidden = authType !== "bearer";

    var actorSource = radioVal("actorSource");
    els.actorLaunchHint.hidden = actorSource === "static";
    els.actorNameReq.textContent = actorSource === "static" ? "" : "(fallback)";

    var isCustomVerb = els.verbPreset.value === "__custom";
    els.verbCustomFields.hidden = !isCustomVerb;
    els.resultFields.hidden = !els.optResult.checked;
    els.domainFields.hidden = !els.optDomain.checked;

    var m = buildModel();
    els.verbIriHint.textContent = isCustomVerb ? "" : ("Verb IRI: " + m.verb.id);

    lastSnippet = buildSnippet(m);
    els.snippetOut.textContent = lastSnippet;
    els.snippetRaw.value = lastSnippet;

    if (isProxy && !els.proxyUrl.value) setStatus("Add your Worker URL to finish.", "err");
    else if (!isProxy && !els.endpoint.value) setStatus("Add your LRS endpoint to finish.", "err");
    else if (!els.objectId.value) setStatus("Tip: set a stable Activity ID (IRI).", "");
    else if (isProxy) setStatus("Ready \u2014 no credentials in this snippet. \ud83d\udd12", "ok");
    else setStatus("Ready. Copy and paste into an Embed \u203a Code block.", "ok");

    saveConfig();
  }

  // ---------- persistence ----------
  function collectConfig() {
    var data = {};
    Object.keys(PERSIST).forEach(function (id) {
      var el = $(id);
      if (el) data[id] = (PERSIST[id] === "checked") ? el.checked : el.value;
    });
    PERSIST_RADIOS.forEach(function (name) { data["radio:" + name] = radioVal(name); });
    return data;
  }
  var saveTimer = null;
  function saveConfig() {
    if (!hasStorage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var payload = {};
      payload[STORAGE_KEY] = collectConfig();
      try { chrome.storage.local.set(payload); } catch (e) {}
    }, 250);
  }
  function applyConfig(data) {
    if (!data) return;
    Object.keys(PERSIST).forEach(function (id) {
      if (!(id in data)) return;
      var el = $(id);
      if (!el) return;
      if (PERSIST[id] === "checked") el.checked = !!data[id];
      else el.value = data[id];
    });
    PERSIST_RADIOS.forEach(function (name) {
      var v = data["radio:" + name];
      if (v) setRadio(name, v);
    });
  }
  function loadConfig(done) {
    if (!hasStorage) { done(); return; }
    try {
      chrome.storage.local.get(STORAGE_KEY, function (res) {
        applyConfig(res && res[STORAGE_KEY]);
        done();
      });
    } catch (e) { done(); }
  }

  // ---------- actions ----------
  function copySnippet() {
    function done() {
      els.copyBtn.textContent = "Copied \u2713";
      setStatus("Copied. Paste it into your Embed \u203a Code block.", "ok");
      setTimeout(function () { els.copyBtn.textContent = "Copy snippet"; }, 1800);
    }
    function fallback() {
      els.snippetRaw.classList.remove("sr-only");
      els.snippetRaw.focus(); els.snippetRaw.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { setStatus("Press Ctrl/Cmd+C to copy the selected text.", ""); }
      els.snippetRaw.classList.add("sr-only");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastSnippet).then(done, fallback);
    } else { fallback(); }
  }

  function downloadSnippet() {
    var blob = new Blob([lastSnippet], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "rise-xapi-snippet.txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus("Downloaded rise-xapi-snippet.txt", "ok");
  }

  function resetFields() {
    form.reset();
    if (hasStorage) { try { chrome.storage.local.remove(STORAGE_KEY); } catch (e) {} }
    regenerate();
    setStatus("Fields reset.", "");
  }

  function closePanel() {
    try { window.parent.postMessage({ source: "xag-panel", type: "close" }, "*"); }
    catch (e) {}
  }

  // ---------- wire up ----------
  form.addEventListener("input", regenerate);
  form.addEventListener("change", regenerate);
  els.copyBtn.addEventListener("click", copySnippet);
  els.downloadBtn.addEventListener("click", downloadSnippet);
  els.resetBtn.addEventListener("click", resetFields);
  els.closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(); });

  loadTemplate(function () {
  loadConfig(function () {
    if (!els.objectId.value) els.objectId.value = "https://orbis.org/xapi/rise/module-1/intro";
    if (!els.objectName.value) els.objectName.value = "Introduction";
    regenerate();
  });
  });
})();
