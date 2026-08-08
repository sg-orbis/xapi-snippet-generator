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

---

# v3.1.1 — contrast fix

**This fixes a bug I introduced in 3.1.0. Do not ship 3.1.0.**

In 3.1.0 a single token, `--well`, was doing two jobs: the recessed input
background and the code pane. In dark mode both are near-black so it looked
correct. In light mode `--well` was deliberately kept dark (`#0d1219`) so the
code pane stays a dark surface — which is right for the code pane and wrong for
inputs, whose text uses `--fg` (`#0e1621` in light mode). The result was
near-black text on a near-black field: form values were invisible.

- `--well` is now the code pane only. `--field` is the recessed input surface —
  near-black in dark, `#e9edf3` in light.
- `--inset` / `--inset-2` carry the matching inner shadow, which has to be far
  softer on a light background than on a dark one.
- Dark is now genuinely the default. 3.1.0 deferred to `prefers-color-scheme`,
  so a machine set to light landed in the light theme despite "dark-first".
  First run is dark; the theme button cycles dark -> light -> auto.

While fixing that, an automated contrast audit of every text-on-surface pair
found four more failures, all now corrected:

| Pair | Was | Now |
|---|---|---|
| Placeholder text (dark) | 2.59:1 | 5.31:1 |
| Placeholder text (light) | 2.26:1 | 4.56:1 |
| Code comments | 2.80:1 | 4.79:1 |
| Accent text on card (light) | 3.74:1 | 5.47:1 |
| Primary button label (light) | 3.74:1 | 6.36:1 |

Every text-on-surface pair in both themes now clears 4.5:1, which is WCAG AA
for normal-size text. Worst remaining pair is 4.54:1.

---

# v3.2.0 — motion

Motion explains a change; it never decorates. Nothing here is ambient, nothing
loops, nothing bounces. Six additions, each because the UI previously snapped
and left you to work out what moved:

1. **Accordions animate open and closed.** This was the worst offender — the
   whole workspace jumped and you had to re-find your place. `<details>` cannot
   be height-transitioned in CSS because the browser toggles `display` on the
   content, so it is driven with the Web Animations API. The `open` attribute
   stays authoritative, so a screen reader still sees a normal disclosure.
2. **Tab panes fade and rise** instead of hard-swapping via `hidden`. Only a
   pane that is actually appearing animates, so a re-render of the visible pane
   does not flicker while you type.
3. **Incomplete to Ready is acknowledged.** The accent rail and the flag pulse
   once. Fires on the transition only, never while already ready.
4. **The verb flashes when it changes.** Keyed off the resolved verb IRI, not an
   input event, so typing never triggers it.
5. **Copy has a physical confirmation** — an expanding ring on the button. A
   primary action that only swaps a text label reads as uncertainty about
   whether the click registered.
6. **A staged rise on first paint.** Templates load async, so the workspace used
   to appear fully formed after a beat of nothing. Runs once, on boot.

Budget: 130ms micro-interactions, 200ms state changes, 320ms entrances, on a
decelerating curve. Only `transform`, `opacity`, `box-shadow` and `background`
are animated — the accordion is the sole exception, and it has to be, because
height is the thing being communicated.

`prefers-reduced-motion` disables all of it, and the JS checks the same query
and falls back to native `<details>` behaviour rather than animating to zero
duration.

## Two bugs found while building this

- **The pip pulse could never have fired.** `paintStates()` added the class and
  `paintStatus()` ran immediately after, assigning `className` wholesale and
  wiping it before a frame rendered. The transition is now reported to the
  caller and pulsed after painting.
- **Double-clicking an accordion closed it twice.** `open` stays `true` for the
  duration of a closing animation, so a fast second click read the live
  attribute and tried to close again instead of reopening. It now tracks
  intent rather than the attribute.
