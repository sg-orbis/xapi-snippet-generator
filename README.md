# How to use this Chrome Extension?
- Install this extension on the Chromium web browser.
- Open rise.articulate.com.
- On the Rise editor page, you will see the Chrome extension enabled.
- Click the floating xAPI snippet button (bottom-right).
- Configure, copy, and paste into the Code block.
- Publish the course as SCORM/xAPI and upload to your LMS/LRS.
- It fires when the learner loads that block.

<img width="768" height="371" alt="xapisnippet" src="https://github.com/user-attachments/assets/ce2ea447-abaf-4303-8f98-aeaaf59c9ce9" />


## Using xAPI Proxy Worker

A small Cloudflare Worker that keeps your LRS credentials **out of your course**.

Your course sends statements here with no credentials; this worker adds the real
Authorization header from its encrypted secrets and forwards them to your LRS.

## Files
- `worker.js` — the proxy (paste this into the Cloudflare dashboard)
- `SETUP-GUIDE.md` — step-by-step setup, written for non-developers
- `wrangler.toml` — optional, for CLI deployment

## Quick start
Follow `SETUP-GUIDE.md`. Roughly: create a free Cloudflare account → create a
Worker → paste `worker.js` → add your `LRS_ENDPOINT`, `ALLOWED_ORIGINS`,
`LRS_KEY` and `LRS_SECRET` → deploy → paste the Worker URL into the extension's
"Via proxy" option.

## Settings
| Name | Type | Required | Purpose |
|---|---|---|---|
| `LRS_ENDPOINT` | Variable | yes | Base xAPI URL; `/statements` is appended |
| `ALLOWED_ORIGINS` | Variable | yes | Comma-separated origins; `*.example.com` supported |
| `LRS_KEY` / `LRS_SECRET` | Secret | one of | Basic auth credentials |
| `LRS_TOKEN` | Secret | one of | Bearer token / JWT |
| `RATE_LIMIT_PER_MIN` | Variable | no | Default 60, per client IP |
| `MAX_BODY_BYTES` | Variable | no | Default 102400 |

## Built-in protections
- Origin allowlist (exact + wildcard), enforced on preflight and POST
- Per-IP rate limiting
- Body size cap and xAPI statement shape validation
- Health check on `GET` that never reveals secrets

## Verify
`GET` your worker URL in a browser. `{"configured":true}` means credentials are set.
