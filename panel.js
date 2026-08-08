"use strict";
/* ==========================================================================
   xAPI Snippet Generator — panel logic (v3)

   The CONFIG object produced by buildModel() is intentionally byte-identical
   to v2. snippet-template.txt and the published runtime depend on that shape,
   so this rebuild changes the interface and leaves the contract alone.

   What is new here:
     - buildSentence() renders the statement as English. It reads from the same
       model that emits the JSON, so it cannot drift from what you paste.
     - Validation is honest. v2 counted "1 of 3" by hardcoding a pass for the
       learner section; there is no invented progress now.
     - Credentials are password fields and are only written to storage when
       "Remember this credential" is on.
     - Reset asks once before it wipes a filled-in configuration.
   ========================================================================== */
(function () {

  /* ============================== constants ============================== */

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
  var PRESET_KEY  = "xag-presets-v1";
  var THEME_KEY   = "xag-theme-v1";

  var SECRET_IDS = ["authKey", "authSecret", "authToken"];

  var hasStorage = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);

  var $ = function (id) { return document.getElementById(id); };
  var form = $("cfg");

  var els = {};
  ["endpoint","authKey","authSecret","authToken","proxyUrl","basicFields","bearerFields",
   "proxyFields","directFields","optRemember",
   "actorName","actorEmail","nameRole","autoNote",
   "verbPreset","verbCustom","verbId","verbDisplay","verbIri",
   "objectId","objectName","objectType","objectDesc",
   "optOnce","optResult","resultFields","resCompletion","resSuccess","resScore","optDebug",
   "optDomain","domainFields","allowedDomains","optStrictDomain",
   "paneCode","paneJson","paneDiag","tabCode","tabJson","tabDiag","lineCount","diagNote",
   "clipHelper","status","statusText","copyBtn","copyLabel","downloadBtn","resetBtn",
   "closeBtn","themeBtn","toast",
   "sentence","stmtMeta","stmtFlag",
   "tickSend","tickWho","tickWhen","stateSend","stateWho","stateWhen",
   "foldSend","foldWho","foldWhen",
   "presetPick","presetName","presetSave","presetDelete","presetManage"
  ].forEach(function (id) { els[id] = $(id); });

  /* Fields written to storage. Secrets are handled separately so they can be
     left out entirely when the user has not opted in. */
  var PERSIST = {
    endpoint: "value", proxyUrl: "value",
    actorName: "value", actorEmail: "value",
    verbPreset: "value", verbId: "value", verbDisplay: "value",
    objectId: "value", objectName: "value", objectType: "value", objectDesc: "value",
    optOnce: "checked", optResult: "checked", resCompletion: "checked",
    resSuccess: "checked", resScore: "value", optDebug: "checked",
    optDomain: "checked", allowedDomains: "value", optStrictDomain: "checked",
    optRemember: "checked"
  };
  var PERSIST_RADIOS = ["authType", "actorSource", "connMode"];

  /* =============================== helpers =============================== */

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
  function isUrl(v) { return /^https?:\/\/[^\s]+$/i.test((v || "").trim()); }
  function hostOf(v) {
    try { return new URL((v || "").trim()).host; } catch (e) { return ""; }
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function trunc(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  /* ================================ model ================================
     Shape frozen — see the header note. */

  function buildModel() {
    var connMode = radioVal("connMode");
    var authType = radioVal("authType");
    var auth;
    if (authType === "bearer") {
      var tok = (els.authToken.value || "").trim();
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
        .map(function (x) {
          return x.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        })
        .filter(function (x) { return x.length > 0; });
    }

    var isProxy = connMode === "proxy";
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

  function previewStatement(m) {
    var stmt = { actor: m.fallbackActor, verb: m.verb, object: m.object };
    if (m.result) stmt.result = m.result;
    stmt.timestamp = "<set when the block loads>";
    return stmt;
  }

  /* ============================== templates ============================== */

  var SNIPPET_TEMPLATE = "";
  var DIAG_TEMPLATE = "";

  function loadTemplates(done) {
    var pending = 2;
    function tick() { if (--pending === 0) done(); }
    function grab(file, set) {
      try {
        fetch(chrome.runtime.getURL(file))
          .then(function (r) { return r.text(); })
          .then(function (t) { set(t); tick(); }, tick);
      } catch (e) { tick(); }
    }
    grab("snippet-template.txt", function (t) { SNIPPET_TEMPLATE = t; });
    grab("diagnostic-template.txt", function (t) { DIAG_TEMPLATE = t; });
  }

  function buildSnippet(m) {
    if (!SNIPPET_TEMPLATE) return "";
    var cfg = {
      endpoint: m.endpoint, proxyMode: m.proxyMode, version: m.version, auth: m.auth,
      actorSource: m.actorSource, fallbackActor: m.fallbackActor,
      verb: m.verb, object: m.object, result: m.result,
      onceKey: m.onceKey,
      allowedDomains: m.allowedDomains, strictDomain: m.strictDomain,
      debug: m.debug
    };
    var cfgJson = JSON.stringify(cfg, null, 2).replace(/\n/g, "\n  ");
    return SNIPPET_TEMPLATE.replace("__XAPI_CONFIG__", function () { return cfgJson; });
  }

  /* ========================= syntax highlighting =========================
     Tokenise first, then escape each piece, so rendered textContent always
     equals the original source exactly. */

  function highlight(src) {
    var out = "";
    var i = 0, n = src.length;

    function span(cls, text) { return '<span class="' + cls + '">' + esc(text) + "</span>"; }

    var KEYWORDS = /^(var|function|return|if|else|for|while|try|catch|new|typeof|this|true|false|null|use strict)$/;

    while (i < n) {
      var ch = src[i];

      if (src.startsWith("<!--", i)) {
        var he = src.indexOf("-->", i);
        if (he === -1) he = n; else he += 3;
        out += span("c", src.slice(i, he)); i = he; continue;
      }
      if (ch === "/" && src[i + 1] === "/") {
        var le = src.indexOf("\n", i); if (le === -1) le = n;
        out += span("c", src.slice(i, le)); i = le; continue;
      }
      if (ch === "/" && src[i + 1] === "*") {
        var be = src.indexOf("*/", i); be = be === -1 ? n : be + 2;
        out += span("c", src.slice(i, be)); i = be; continue;
      }
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n) {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === ch) { j++; break; }
          if (src[j] === "\n") break;
          j++;
        }
        var strTok = src.slice(i, j);
        var k = j; while (k < n && (src[k] === " " || src[k] === "\t")) k++;
        out += span(src[k] === ":" ? "p" : "s", strTok);
        i = j; continue;
      }
      if (/[0-9]/.test(ch) && !/[A-Za-z_$]/.test(src[i - 1] || "")) {
        var nm = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
        if (nm) { out += span("n", nm[0]); i += nm[0].length; continue; }
      }
      if (/[A-Za-z_$]/.test(ch)) {
        var wm = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
        var w = wm[0];
        out += KEYWORDS.test(w) ? span("k", w) : esc(w);
        i += w.length; continue;
      }
      out += esc(ch); i++;
    }
    return out;
  }

  function renderCode(el, text) {
    if (!text) { el.textContent = ""; return; }
    try { el.innerHTML = highlight(text); }
    catch (e) { el.textContent = text; }
  }

  /* ============================ the sentence =============================
     Signature element. Same model as the JSON, rendered as English. */

  function chip(value, goto, placeholder) {
    var empty = !String(value || "").trim();
    var text = empty ? (placeholder || "not set") : value;
    return '<button type="button" class="chip' + (empty ? " empty" : "") +
           '" data-goto="' + esc(goto) + '">' + esc(trunc(text, 42)) + "</button>";
  }

  function buildSentence(m) {
    var src = m.actorSource;
    var who;
    if (src === "static") {
      who = chip(els.actorName.value, "actorName", "a name");
    } else if (src === "prompt") {
      who = "A learner who types their name";
    } else {
      who = "The learner your LMS reports";
    }

    var verbWord = m.verb.display["en-US"] || "did something to";
    var verbEl = '<button type="button" class="verb" data-goto="verbPreset">' +
                 esc(verbWord) + "</button>";

    var what = chip(els.objectName.value, "objectName", "an activity");

    var tail = "";
    if (m.result) {
      var parts = [];
      if (m.result.completion) parts.push("marked complete");
      if (m.result.success) parts.push("marked a pass");
      if (m.result.score) {
        parts.push("scored " + chip(m.result.score.scaled.toFixed(2), "resScore"));
      }
      if (parts.length) {
        tail = " \u2014 " + (parts.length === 1
          ? parts[0]
          : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]);
      }
    }

    els.sentence.innerHTML = who + " " + verbEl + " " + what + tail + ".";

    /* Mark the verb when it actually changed. Typing into a text field must
       never trigger this, which is why it keys off the resolved verb IRI
       rather than any input event. */
    if (lastVerbId !== null && lastVerbId !== m.verb.id) {
      pulse(els.sentence.querySelector(".verb"), "flash", 520);
    }
    lastVerbId = m.verb.id;
  }

  var lastVerbId = null;

  function buildMeta(m) {
    var tags = [];
    var host = hostOf(m.endpoint);

    if (m.proxyMode) {
      tags.push(host
        ? { t: "\u2192 proxy " + host, cls: "on" }
        : { t: "\u2192 proxy not set", cls: "warn" });
    } else {
      tags.push(isUrl(els.endpoint.value)
        ? { t: "\u2192 " + host, cls: "on" }
        : { t: "\u2192 LRS not set", cls: "warn" });
    }

    if (els.objectType.value) {
      tags.push({ t: (els.objectType.value.split("/").pop() || ""), cls: "" });
    }
    if (m.onceKey) tags.push({ t: "once per learner", cls: "" });
    if (els.optDomain.checked) {
      tags.push(m.allowedDomains.length
        ? { t: m.allowedDomains.length + (m.allowedDomains.length === 1 ? " domain" : " domains"), cls: "" }
        : { t: "no domains listed", cls: "warn" });
    }
    if (m.debug) tags.push({ t: "console logging", cls: "" });

    els.stmtMeta.innerHTML = tags.map(function (x) {
      return '<span class="tag ' + x.cls + '">' + esc(x.t) + "</span>";
    }).join("");
  }

  /* Clicking a chip takes you to the field behind it. */
  function wireChips() {
    els.sentence.addEventListener("click", function (e) {
      var b = e.target.closest("[data-goto]");
      if (!b) return;
      var target = $(b.getAttribute("data-goto"));
      if (!target) return;
      var fold = target.closest("details");
      if (fold && !fold.open) animateFold(fold, true);
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    });
  }


  /* =============================== motion ===============================
     Height cannot be transitioned on a <details> element in CSS, because the
     browser toggles display on the content. So the accordion is driven here
     with the Web Animations API while the open attribute stays authoritative
     for accessibility — a screen reader still sees a normal disclosure.

     Every entry point checks prefers-reduced-motion and falls back to the
     native instant behaviour. */

  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  var EASE_OUT = "cubic-bezier(.16, .84, .44, 1)";
  var canAnimate = typeof Element !== "undefined" && !!Element.prototype.animate;

  function motionOff() { return reduceMotion.matches || !canAnimate; }

  /* Brief class toggle used for one-shot keyframes. Forcing a reflow between
     remove and add is what lets the same animation replay back to back. */
  function pulse(el, cls, ms) {
    if (!el || motionOff()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  var foldAnims = new WeakMap();

  function animateFold(details, open) {
    var body = details.querySelector(".fold-body");
    if (!body || motionOff()) { details.open = open; return; }

    var running = foldAnims.get(details);
    if (running) { running.cancel(); foldAnims.delete(details); }

    details.dataset.xagIntent = open ? "1" : "0";

    if (open) {
      details.open = true;
      var target = body.offsetHeight;
      body.style.overflow = "hidden";
      var a = body.animate(
        [{ height: "0px", opacity: 0 }, { height: target + "px", opacity: 1 }],
        { duration: 210, easing: EASE_OUT }
      );
      foldAnims.set(details, a);
      a.onfinish = a.oncancel = function () {
        body.style.overflow = "";
        body.style.height = "";
        foldAnims.delete(details);
      };
    } else {
      var from = body.offsetHeight;
      body.style.overflow = "hidden";
      var b = body.animate(
        [{ height: from + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
        { duration: 170, easing: EASE_OUT }
      );
      foldAnims.set(details, b);
      b.onfinish = function () {
        details.open = false;
        body.style.overflow = "";
        body.style.height = "";
        foldAnims.delete(details);
      };
      b.oncancel = function () {
        body.style.overflow = "";
        body.style.height = "";
        foldAnims.delete(details);
      };
    }
  }

  function wireFolds() {
    [els.foldSend, els.foldWho, els.foldWhen].forEach(function (d) {
      if (!d) return;
      var summary = d.querySelector("summary");
      if (!summary) return;
      summary.addEventListener("click", function (e) {
        if (motionOff()) return;   // let the browser do it natively
        e.preventDefault();
        /* d.open stays true for the duration of a closing animation, so read
           the intent instead — otherwise a fast second click closes twice. */
        var intent = d.dataset.xagIntent;
        var openNow = (intent === undefined) ? d.open : (intent === "1");
        animateFold(d, !openNow);
      });
    });
  }

  /* ============================== validation ============================= */

  function evaluate() {
    var isProxy = radioVal("connMode") === "proxy";
    var sendOk = isProxy
      ? isUrl(els.proxyUrl.value)
      : (isUrl(els.endpoint.value) &&
         (radioVal("authType") === "bearer"
            ? !!els.authToken.value.trim()
            : !!(els.authKey.value.trim() && els.authSecret.value.trim())));

    var whatOk = isUrl(els.objectId.value) && !!els.objectName.value.trim();

    // Domain filtering with an empty list would silently block everything.
    var whenOk = !(els.optDomain.checked && !els.allowedDomains.value.trim());

    return { sendOk: sendOk, whatOk: whatOk, whenOk: whenOk, isProxy: isProxy };
  }

  var wasReady = null;

  function paintTick(el, state) {
    el.className = "tick " + state;
  }

  function paintStates(m, v) {
    /* where it's sent */
    if (v.isProxy) {
      els.stateSend.textContent = isUrl(els.proxyUrl.value)
        ? "proxy \u00b7 " + hostOf(els.proxyUrl.value)
        : "add a proxy URL";
    } else if (!isUrl(els.endpoint.value)) {
      els.stateSend.textContent = "add an LRS endpoint";
    } else {
      els.stateSend.textContent = hostOf(els.endpoint.value) + " \u00b7 " +
        (radioVal("authType") === "bearer" ? "token" : "key");
    }
    els.stateSend.className = "fold-state" + (v.sendOk ? "" : " warn");
    paintTick(els.tickSend, v.sendOk ? "ok" : "warn");

    /* who the learner is */
    var as = radioVal("actorSource");
    els.stateWho.textContent = as === "auto" ? "from the LMS"
      : as === "static" ? "always " + trunc(els.actorName.value || "unnamed", 18)
      : "learner is asked";
    paintTick(els.tickWho, "ok");

    /* when to send */
    var when = [];
    if (els.optOnce.checked) when.push("once");
    if (els.optDomain.checked) when.push(m.allowedDomains.length + " domains");
    if (els.optDebug.checked) when.push("logging");
    els.stateWhen.textContent = when.length ? when.join(" \u00b7 ") : "no limits";
    els.stateWhen.className = "fold-state" + (v.whenOk ? "" : " warn");
    paintTick(els.tickWhen, v.whenOk ? "ok" : "warn");

    /* the flag on the statement card. The pulse fires on the transition into
       Ready only — never on every keystroke while already ready. */
    var ready = v.sendOk && v.whatOk && v.whenOk;
    var becameReady = ready && wasReady === false;
    wasReady = ready;

    els.stmtFlag.textContent = ready ? "Ready" : "Incomplete";
    els.stmtFlag.className = "stmt-flag " + (ready ? "ready" : "wait");

    if (becameReady) {
      pulse(document.querySelector(".stmt"), "just-ready", 700);
      pulse(els.stmtFlag, "just-ready", 260);
    }
    /* The status pip is pulsed by the caller, not here: paintStatus() runs
       next and assigns className wholesale, which would wipe the class. */
    return becameReady;
  }

  function setStatus(msg, kind) {
    els.statusText.textContent = msg || "";
    els.status.className = "status" + (kind ? " " + kind : "");
  }

  function paintStatus(v) {
    if (!v.whatOk) {
      setStatus(!els.objectName.value.trim()
        ? "Name what the learner did it to, above."
        : "Add an Activity ID \u2014 it has to be a full https address.", "bad");
    } else if (!v.sendOk) {
      setStatus(v.isProxy
        ? "Open \u201cWhere it\u2019s sent\u201d and add your proxy URL."
        : "Open \u201cWhere it\u2019s sent\u201d and finish the LRS connection.", "bad");
    } else if (!v.whenOk) {
      setStatus("Domain filtering is on with no domains listed, so nothing would send.", "bad");
    } else if (v.isProxy) {
      setStatus("Ready. No credential in this snippet \u2014 paste it into an Embed \u203a Code block.", "ok");
    } else {
      setStatus("Ready. Paste it into an Embed \u203a Code block.", "ok");
    }
  }

  /* ============================== tabs ================================== */

  var lastSnippet = "";
  var activeTab = "code";

  function currentText() {
    if (activeTab === "json") return els.paneJson.textContent;
    if (activeTab === "diag") return els.paneDiag.textContent;
    return lastSnippet;
  }

  function selectTab(which) {
    activeTab = which;
    var map = {
      code: [els.tabCode, els.paneCode],
      json: [els.tabJson, els.paneJson],
      diag: [els.tabDiag, els.paneDiag]
    };
    Object.keys(map).forEach(function (k) {
      var on = k === which;
      var wasHidden = map[k][1].hidden;
      map[k][0].setAttribute("aria-selected", on ? "true" : "false");
      map[k][1].hidden = !on;
      /* Only animate a pane that is actually appearing, so a re-render of the
         already-visible pane does not flicker on every keystroke. */
      if (on && wasHidden) pulse(map[k][1], "pane-in", 240);
    });
    els.diagNote.hidden = which !== "diag";
    els.copyLabel.textContent =
      which === "json" ? "Copy statement" : which === "diag" ? "Copy test block" : "Copy snippet";

    var txt = currentText();
    var lines = txt ? (txt.match(/\n/g) || []).length + 1 : 0;
    els.lineCount.textContent = lines ? lines + " lines" : "";
  }

  /* ============================ segments ================================ */

  function paintSegments() {
    var labels = form.querySelectorAll(".seg label");
    for (var i = 0; i < labels.length; i++) {
      var lab = labels[i];
      var on = radioVal(lab.getAttribute("data-for")) === lab.getAttribute("data-val");
      lab.classList.toggle("on", on);
    }
  }

  /* ============================== render ================================ */

  function regenerate() {
    var isProxy = radioVal("connMode") === "proxy";
    els.proxyFields.hidden = !isProxy;
    els.directFields.hidden = isProxy;

    var authType = radioVal("authType");
    els.basicFields.hidden = authType !== "basic";
    els.bearerFields.hidden = authType !== "bearer";

    var actorSource = radioVal("actorSource");
    els.autoNote.hidden = actorSource !== "auto";
    els.nameRole.textContent = actorSource === "static" ? "" : "\u2014 fallback";

    var isCustomVerb = els.verbPreset.value === "__custom";
    els.verbCustom.hidden = !isCustomVerb;
    els.resultFields.hidden = !els.optResult.checked;
    els.domainFields.hidden = !els.optDomain.checked;

    paintSegments();

    var m = buildModel();
    els.verbIri.textContent = isCustomVerb ? "" : m.verb.id;

    lastSnippet = buildSnippet(m);
    renderCode(els.paneCode, lastSnippet);
    renderCode(els.paneJson, JSON.stringify(previewStatement(m), null, 2));
    renderCode(els.paneDiag, DIAG_TEMPLATE);

    buildSentence(m);
    buildMeta(m);

    var v = evaluate();
    var becameReady = paintStates(m, v);
    paintStatus(v);
    if (becameReady) pulse(els.status, "just-ok", 700);

    els.endpoint.classList.toggle("bad", !isProxy && !!els.endpoint.value && !isUrl(els.endpoint.value));
    els.proxyUrl.classList.toggle("bad", isProxy && !!els.proxyUrl.value && !isUrl(els.proxyUrl.value));
    els.objectId.classList.toggle("bad", !!els.objectId.value && !isUrl(els.objectId.value));

    selectTab(activeTab);
    saveConfig();
  }

  /* ============================ persistence ============================= */

  function collectConfig(includeSecrets) {
    var data = {};
    Object.keys(PERSIST).forEach(function (id) {
      var el = $(id);
      if (el) data[id] = (PERSIST[id] === "checked") ? el.checked : el.value;
    });
    PERSIST_RADIOS.forEach(function (nm) { data["radio:" + nm] = radioVal(nm); });
    if (includeSecrets) {
      SECRET_IDS.forEach(function (id) { data[id] = $(id).value; });
    }
    return data;
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
    SECRET_IDS.forEach(function (id) {
      if (id in data) $(id).value = data[id] || "";
    });
    PERSIST_RADIOS.forEach(function (nm) {
      var v = data["radio:" + nm];
      if (v) setRadio(nm, v);
    });
  }

  var saveTimer = null;
  function saveConfig() {
    if (!hasStorage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var p = {};
      p[STORAGE_KEY] = collectConfig(els.optRemember.checked);
      try { chrome.storage.local.set(p); } catch (e) {}
    }, 250);
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

  /* ============================== presets =============================== */

  var presets = {};

  function renderPresets() {
    var names = Object.keys(presets).sort();
    var keep = els.presetPick.value;
    els.presetPick.innerHTML = "";

    var head = document.createElement("option");
    head.value = "";
    head.textContent = names.length ? "Load a setup\u2026" : "No saved setups";
    els.presetPick.appendChild(head);

    names.forEach(function (nm) {
      var o = document.createElement("option");
      o.value = nm;
      o.textContent = nm;
      els.presetPick.appendChild(o);
    });

    if (keep && presets[keep]) els.presetPick.value = keep;
    els.presetPick.disabled = names.length === 0;
    els.presetManage.hidden = !(els.presetPick.value && presets[els.presetPick.value]);
  }

  function loadPresets(done) {
    if (!hasStorage) { renderPresets(); done && done(); return; }
    try {
      chrome.storage.local.get(PRESET_KEY, function (res) {
        presets = (res && res[PRESET_KEY]) || {};
        renderPresets();
        done && done();
      });
    } catch (e) { renderPresets(); done && done(); }
  }

  function persistPresets() {
    if (!hasStorage) return;
    var p = {};
    p[PRESET_KEY] = presets;
    try { chrome.storage.local.set(p); } catch (e) {}
  }

  /* ============================== actions =============================== */

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove("show"); }, 2000);
  }

  function copyCurrent() {
    var text = currentText();
    if (!text) { toast("Nothing to copy yet"); return; }

    function done() {
      toast(activeTab === "diag" ? "Test block copied"
          : activeTab === "json" ? "Statement copied"
          : "Snippet copied");
      var prev = els.copyLabel.textContent;
      els.copyLabel.textContent = "Copied";
      pulse(els.copyBtn, "copied", 600);
      setTimeout(function () { els.copyLabel.textContent = prev; }, 1500);
    }

    function fallback() {
      els.clipHelper.classList.remove("sr-only");
      els.clipHelper.style.position = "absolute";
      els.clipHelper.style.left = "-9999px";
      els.clipHelper.value = text;
      els.clipHelper.focus();
      els.clipHelper.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Press Ctrl or Cmd + C to copy"); }
      els.clipHelper.classList.add("sr-only");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
  }

  function download() {
    var text = currentText();
    if (!text) { toast("Nothing to save yet"); return; }
    var name = activeTab === "diag" ? "xapi-test-block.txt"
             : activeTab === "json" ? "xapi-statement.json"
             : "rise-xapi-snippet.txt";
    var blob = new Blob([text], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Saved " + name);
  }

  /* Reset is destructive and sits next to Copy, so it asks first. */
  var resetArmed = false;
  var resetTimer = null;

  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTimer);
    els.resetBtn.classList.remove("danger");
    els.resetBtn.title = "Clear every field";
  }

  function onReset() {
    if (!resetArmed) {
      resetArmed = true;
      els.resetBtn.classList.add("danger");
      els.resetBtn.title = "Click again to clear every field";
      toast("Click again to clear every field");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    form.reset();
    if (hasStorage) { try { chrome.storage.local.remove(STORAGE_KEY); } catch (e) {} }
    seedDefaults();
    regenerate();
    toast("Every field cleared");
  }

  function hidePanel() {
    try { window.parent.postMessage({ source: "xag-panel", type: "close" }, "*"); } catch (e) {}
  }

  /* =============================== theme ================================ */

  /* Dark-first: dark is the default on first run. "auto" is still available
     through the cycle, but it is opt-in rather than the starting state. */
  var THEMES = ["dark", "light", "auto"];
  var THEME_TITLE = {
    dark: "Theme: dark",
    light: "Theme: light",
    auto: "Theme: follows your system"
  };

  function applyTheme(t) {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    els.themeBtn.title = THEME_TITLE[t] || THEME_TITLE.auto;
  }

  function cycleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "dark";
    var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    applyTheme(next);
    if (hasStorage) {
      var p = {}; p[THEME_KEY] = next;
      try { chrome.storage.local.set(p); } catch (e) {}
    }
    toast(THEME_TITLE[next]);
  }

  /* =============================== wiring =============================== */

  form.addEventListener("input", regenerate);
  form.addEventListener("change", regenerate);

  wireChips();

  els.copyBtn.addEventListener("click", copyCurrent);
  els.downloadBtn.addEventListener("click", download);
  els.resetBtn.addEventListener("click", onReset);
  els.closeBtn.addEventListener("click", hidePanel);
  els.themeBtn.addEventListener("click", cycleTheme);

  els.tabCode.addEventListener("click", function () { selectTab("code"); });
  els.tabJson.addEventListener("click", function () { selectTab("json"); });
  els.tabDiag.addEventListener("click", function () { selectTab("diag"); });

  /* reveal buttons on secret fields */
  Array.prototype.forEach.call(document.querySelectorAll(".peek"), function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-peek"));
      if (!input) return;
      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", (showing ? "Show " : "Hide ") +
        (input.id === "authToken" ? "token" : input.id === "authKey" ? "key" : "secret"));
      input.focus();
    });
  });

  /* presets — the bar menu loads, the card saves and deletes */
  els.presetPick.addEventListener("change", function () {
    var nm = els.presetPick.value;
    els.presetManage.hidden = !(nm && presets[nm]);
    if (!nm || !presets[nm]) return;
    applyConfig(presets[nm]);
    regenerate();
    toast("Loaded \u201c" + nm + "\u201d");
  });

  els.presetSave.addEventListener("click", function () {
    var nm = (els.presetName.value || "").trim();
    if (!nm) { toast("Name the setup first"); els.presetName.focus(); return; }
    // A saved setup always carries its credential, otherwise it cannot be reused.
    presets[nm] = collectConfig(true);
    persistPresets();
    els.presetPick.value = nm;
    renderPresets();
    els.presetName.value = "";
    toast("Saved \u201c" + nm + "\u201d");
  });

  els.presetDelete.addEventListener("click", function () {
    var nm = els.presetPick.value;
    if (!nm || !presets[nm]) { toast("Pick a setup first"); return; }
    delete presets[nm];
    persistPresets();
    els.presetPick.value = "";
    renderPresets();
    toast("Deleted \u201c" + nm + "\u201d");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { hidePanel(); return; }
    var meta = e.metaKey || e.ctrlKey;
    // Only hijack copy inside the output panes, so Ctrl+C stays normal in fields.
    if (meta && (e.key === "c" || e.key === "C")) {
      var inWell = e.target && e.target.classList && e.target.classList.contains("well");
      if (inWell && !window.getSelection().toString()) { copyCurrent(); e.preventDefault(); }
    }
  });

  /* ================================ boot ================================ */

  function seedDefaults() {
    if (!els.objectId.value) els.objectId.value = "https://example.org/xapi/course/lesson-1";
    if (!els.objectName.value) els.objectName.value = "Lesson 1";
    if (!els.actorName.value) els.actorName.value = "Anonymous Learner";
  }

  /* Setup that is already valid starts collapsed, so the first thing on screen
     is the part you actually change per block. */
  function setInitialFolds() {
    var v = evaluate();
    els.foldSend.open = !v.sendOk;
    els.foldWho.open = false;
    els.foldWhen.open = !v.whenOk;
  }

  function finish() {
    seedDefaults();
    setInitialFolds();
    regenerate();
    wireFolds();
    playBootIn();
  }

  /* One staged rise on first paint, then the classes come off so nothing
     re-animates on later re-renders. */
  function playBootIn() {
    if (motionOff()) return;
    var work = document.querySelector(".work");
    var out = document.querySelector(".out");
    if (work) work.classList.add("boot");
    if (out) out.classList.add("boot");
    setTimeout(function () {
      if (work) work.classList.remove("boot");
      if (out) out.classList.remove("boot");
    }, 800);
  }

  function boot() {
    loadTemplates(function () {
      loadPresets(function () {
        loadConfig(function () {
          if (hasStorage) {
            try {
              chrome.storage.local.get(THEME_KEY, function (r) {
                applyTheme((r && r[THEME_KEY]) || "dark");
                finish();
              });
              return;
            } catch (e) {}
          }
          applyTheme("dark");
          finish();
        });
      });
    });
  }

  boot();
})();
