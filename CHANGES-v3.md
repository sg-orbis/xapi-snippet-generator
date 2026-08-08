# v3.0.0 — interface rebuild

The snippet runtime is untouched. `snippet-template.txt`, `diagnostic-template.txt`
and the `proxy/` worker are byte-identical to v2, and the `CONFIG` object the
panel writes into a snippet has exactly the same 13 keys in the same order.
**Snippets already pasted into published courses keep working.** Everything below
is interface.

## The statement now reads as a sentence

An xAPI statement is actor + verb + object + result, so the panel opens with that
sentence rendered in English from the same model that emits the JSON:

> The learner your LMS reports **completed** `Lesson 1` — marked complete and scored `0.90`.

The values are chips. Clicking one opens the section it lives in and focuses the
field. Because the sentence and the JSON come from one model they cannot drift,
which makes it a real check rather than a decoration.

## The panel no longer blocks Rise

The backdrop is gone. The dock is non-modal, so the Rise editor stays live and
you can paste into an Embed › Code block without closing anything. Drag the left
edge to resize (or focus the grip and use arrow keys); the width is remembered.
The launcher button now toggles and slides clear of the dock instead of hiding.

## Sections are ordered by how often you touch them

*What happened* changes for every block, so it is first and always open.
*Where it's sent*, *Who the learner is* and *When to send* are per-LMS setup —
they sit under a **Setup** heading and start collapsed once they are valid.

The 1–5 numbering is gone. These were never a sequence, and the numbers implied
you had to walk through them in order.

## Fixes

- **Progress was fictional.** v2 computed `done = connOk + stmtOk + 1`, hardcoding
  a pass for the learner section, and labelled it "of 3" beneath five numbered
  sections. Replaced with a Ready / Incomplete flag and per-section state text
  that says what is actually missing.
- **Three of five status dots were decorative.** `dotLearner` was hardcoded to
  green in the HTML and never updated; Rules and Presets had static green dots.
  Now every indicator is driven by a real check, and it is an icon rather than
  colour alone.
- **Credentials were plain text inputs, auto-saved on every keystroke.** They are
  now password fields with a reveal control, and they are only written to
  `chrome.storage.local` when *Remember this credential* is on (off by default).
  Saved setups always carry their credential, since otherwise they cannot be reused.
- **Segmented controls had no focus indicator.** The radio is transparent, so the
  ring is now drawn on the label via `:focus-visible`.
- **Reset wiped everything on one click.** It now arms on the first click and
  clears on the second, and disarms itself after four seconds.
- **Empty domain list silently blocked all sending.** Turning on domain filtering
  with nothing listed is now flagged as incomplete.
- **Ctrl/Cmd+C was intercepted panel-wide** whenever nothing was selected, which
  broke copy inside form fields. It now only applies inside the output panes.
- **The re-attach MutationObserver ran work on every DOM mutation** in a heavy
  SPA. It is throttled to one check per animation frame, and it stands down when
  you navigate to a `/share/` route.

## Visual language

Warm paper, deep teal, ink-teal code well, no gradients. One semantic rule:
monospace means "this is a machine address" — IRIs, verbs, keys, domains,
activity types. Prose is always sans, so the typeface itself tells you which
fields are identifiers.

## Storage migration

Nothing to do. v3 reads the same `xag-config-v1` and `xag-presets-v1` keys. A
config saved by v2 will load with its credential intact; the *Remember this
credential* switch starts off, so the next save drops the secret unless you turn
it on. If you would rather clear the old stored secret immediately, load the
panel once, leave the switch off, and change any field.

---

# v3.0.1

Added a credit footer at the foot of the workspace column and in the toolbar
popup: *Developed by Shailesh G.*, linking to
<https://www.linkedin.com/in/shailesh-elearn/>. It opens in a new tab
(`target="_blank"` with `rel="noopener noreferrer"`).

Placed at the end of the scrolling workspace rather than in the action bar, so
it never takes vertical space away from Copy, and it sits under the left column
in two-column mode.

---

# v3.1.0 — dark-first console skin

Look and feel only. No markup change, no logic change, no manifest permission
change. `panel.css`, `content.css` and the popup's inline styles were rewritten;
every class name is identical, so `panel.html` and `panel.js` are untouched.

The v3.0 skin was deliberately flat — hairline borders, no gradients, minimal
shadow. That read as plain. Depth now comes from five stacked techniques rather
than one heavy drop shadow:

1. **Surfaces step up in luminance** as they come forward (`--bg` -> `--s1` ->
   `--s2` -> `--s3`), so hierarchy is legible without borders doing all the work.
2. **Every raised surface carries a 1px top-edge highlight** (`--edge`). This is
   how light behaves on a bevel, and it is the single biggest reason a card
   stops reading as a flat rectangle.
3. **The accent casts a colour-matched glow**, not a grey shadow — the primary
   button, the statement rail, the status pip and the toggle all bloom teal.
4. **Inputs and the code well are recessed** with inner shadow, the opposite
   bevel to cards, so a field reads as a hole you type into.
5. **A faint dot grid** gives the canvas texture at almost no contrast cost,
   plus one accent bloom behind the top of the panel.

Other changes:

- Dark is now the base, not a variant. Light is still available through the
  theme button and still follows the system preference, but it is secondary.
- Accent moved from deep teal `#0e7c7b` to electric teal `#2dd4bf`, which holds
  up on a near-black canvas and glows.
- Density tightened roughly 10% — base type 13px to 12.5px, padding reduced
  throughout.
- Structural labels are now mono, uppercase and wide-tracked, matching the
  console vernacular.
- The status pip reads as an LED, with a glow halo when live.
- The injected toggle and dock edge were repainted to match, so the host chrome
  and the panel are one piece.

The v3.0 warm-paper skin is preserved as `panel-v3-paper.css` in case you want
to switch back — it is a straight file swap.
