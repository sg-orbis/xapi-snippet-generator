# Release notes — v3.0.1

Three versions below. Use the one that fits the channel.

---

## 1. Chrome Web Store listing

The store has no changelog field, so this goes at the **top of the Description**,
above your existing product copy. Move it below the product copy after a few
weeks, once most users have updated.

### Short description (132 character limit)

> Build xAPI statement snippets for Articulate Rise. Live statement preview, SCORM learner detection, and proxy delivery.

### Description block

```
WHAT'S NEW IN 3.0

Snippets you have already pasted into published courses are unaffected. The
code this extension generates is unchanged, so nothing you have shipped needs
to be touched.

One change to know about: saved LRS credentials are no longer stored unless you
ask. Open "Where it's sent" and turn on "Remember this credential" if you want
the extension to keep it. Otherwise you will be asked for it once per session.

- The statement now reads as a sentence. The panel opens with a plain-English
  summary of what your snippet will send, built from the same data as the JSON,
  so a mistake is visible before you paste anything. Click any part of it to
  jump to the field behind it.

- The panel no longer blocks the Rise editor. It docks to the side and stays
  out of the way, so you can copy a snippet and paste it into an Embed > Code
  block without closing anything. Drag its left edge to resize; the width is
  remembered.

- Sections are ordered by how often you change them. The activity details you
  edit for every block come first. Connection, learner and rule settings are
  grouped under Setup and stay collapsed once they are valid.

- Credentials are hidden by default, with a reveal button, and are only written
  to your computer if you opt in.

- Clearer wording throughout, an accessible focus indicator on every control,
  and a confirmation step before Reset clears your fields.
```

---

## 2. In-panel notice

Suggested copy for a dismissible strip shown on first open after the update.
Keep it to three lines — anything longer gets dismissed unread.

> **Updated to 3.0.** Your published snippets are unaffected.
> Saved credentials are no longer kept unless you turn on **Remember this
> credential** under *Where it's sent*.
> [See what changed] [Dismiss]

---

## 3. Internal notes (Cybersight Learn team / LinkedIn post)

**xAPI Snippet Generator for Articulate Rise — v3.0**

The interface is rebuilt. The runtime is not: `snippet-template.txt`, the
diagnostic block and the proxy worker are byte-identical to v2, and the CONFIG
object written into a snippet has the same thirteen keys in the same order.
Anything already live keeps working.

**What changed and why**

An xAPI statement is a sentence — actor, verb, object, result. Every generator
I have seen presents that as a form with field labels, which means you cannot
tell whether the thing you are about to paste is correct without reading the
JSON. So the panel now opens with the statement rendered as English, generated
from the same model that emits the JSON. It cannot drift from what you copy.

The panel was also modal, which meant it covered the code block you were
pasting into. It is now a non-modal, resizable dock, so the editor stays live.

Sections were numbered 1 to 5 as though they were a sequence. They are not —
one of them changes per block and three are set once per LMS. They are now
grouped and ordered by how often you touch them.

**Fixes**

- Progress was fictional: the old "0 of 3" hardcoded a pass for the learner
  section and sat beneath five numbered sections. Replaced with a Ready /
  Incomplete flag and per-section text saying what is actually missing.
- Three of five status dots were decorative — hardcoded green in the markup and
  never updated. Every indicator is now driven by a real check.
- Credentials were plain-text inputs written to storage on every keystroke.
  Now password fields with a reveal control, stored only on opt-in.
- Segmented controls had no visible keyboard focus. The radio is transparent,
  so the ring is now drawn on the label.
- Reset wiped a filled configuration on a single click. It now arms first.
- Turning on domain filtering with an empty list silently blocked all sending.
  Now flagged as incomplete.
- Ctrl/Cmd+C was intercepted panel-wide whenever nothing was selected, which
  broke copy inside form fields. Scoped to the output panes.
- The re-attach observer ran on every DOM mutation in a heavy SPA. Throttled to
  one check per frame, and it stands down on `/share/` routes.

**Migration**

Same storage keys, so configs and presets carry over. The only behavioural
change is credential storage, which is now opt-in.

---

## Publishing checklist

- [ ] Confirm `manifest.json` version reads `3.0.1` — the store rejects an
      upload whose version is not higher than the published one.
- [ ] Zip the **contents** so `manifest.json` sits at the archive root, not
      inside a nested folder.
- [ ] Permissions and `content_scripts.matches` are unchanged from v2. Keep
      them that way — any addition disables the extension for every existing
      user until they re-consent.
- [ ] Screenshots in the listing still show the v2 indigo UI. Replace them, or
      the store page will not match what installs.
- [ ] Check the dashboard for a staged or percentage rollout option before
      publishing to everyone; availability varies by item and account.
- [ ] Expect a review window. It is usually short for a minor update with no
      permission changes, but it is not instant and not guaranteed.
- [ ] Tell the team out of band. For an internal tool this reaches people
      faster than anything in the product.
