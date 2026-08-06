# Set up your xAPI proxy — a step‑by‑step guide

**What this does:** it puts a trusted "middleman" between your course and your LRS, so your LRS key and password **never appear inside your course**. Learners can't see them, and neither can your LMS.

**Who this is for:** anyone. You don't need to be a developer — it's mostly copy, paste, and clicking buttons.

**Time needed:** about 10–15 minutes, once.
**Cost:** free. Cloudflare's free plan allows 100,000 requests a day, which is far more than most courses ever use.

---

## Before you start, have these three things ready

1. Your **LRS endpoint URL** — e.g. `https://lrs.example.com/xapi/`
2. Your **LRS key and secret** (or a bearer token)
3. Your **LMS web address** — e.g. `https://learn.cybersight.org`

---

## Step 1 — Create a free Cloudflare account

1. Go to **https://dash.cloudflare.com/sign-up**
2. Sign up with your email and verify it.
3. You do **not** need to add a domain or a payment card.

---

## Step 2 — Create the Worker

1. In the left‑hand menu, click **Compute (Workers)** — on some accounts it's **Workers & Pages**.
2. Click **Create** → **Start with Hello World!** → **Get started**.
3. Give it a name, for example `xapi-proxy`. **Write down the name** — your URL will be `https://xapi-proxy.<your-account>.workers.dev`.
4. Click **Deploy**. (It deploys the sample code; you'll replace it next.)

---

## Step 3 — Paste in the proxy code

1. On your new Worker's page, click **Edit code** (or **</> Edit code**).
2. Select **everything** in the editor and delete it.
3. Open the file **`worker.js`** included with this guide, copy **all** of it, and paste it in.
4. Click **Deploy** (top right).

---

## Step 4 — Add your settings

This is the important part — it's where your credentials go, safely on the server.

1. Go back to your Worker's page and open **Settings** → **Variables and Secrets**.
2. Add each of the following with **Add**:

| Name | Type | Value |
|---|---|---|
| `LRS_ENDPOINT` | Text | Your LRS URL, e.g. `https://lrs.example.com/xapi/` |
| `ALLOWED_ORIGINS` | Text | Your LMS address, e.g. `https://learn.cybersight.org` |
| `LRS_KEY` | **Secret** | Your LRS key / username |
| `LRS_SECRET` | **Secret** | Your LRS password / secret |

> **Choose "Secret" (not Text) for `LRS_KEY` and `LRS_SECRET`.** Secrets are encrypted and can't be read back — that's the whole point.

**Using a token instead of a key/secret?** Skip `LRS_KEY` and `LRS_SECRET` and add a single secret called `LRS_TOKEN` with your token or JWT.

**Multiple LMS domains?** Separate them with commas. You can use `*.` for all subdomains:
`https://learn.cybersight.org, *.orbis.org`

3. Click **Deploy** to apply.

---

## Step 5 — Check it's working

1. Copy your Worker URL: `https://xapi-proxy.<your-account>.workers.dev`
2. Paste it into a browser tab and press Enter.
3. You should see something like:

```json
{"ok":true,"service":"xapi-proxy","configured":true,"allowedOriginCount":1}
```

- **`"configured": true`** → your credentials are set correctly. ✅
- **`"configured": false`** → go back to Step 4; something is missing.

---

## Step 6 — Use it in the extension

1. Open a course in Rise and click the **xAPI snippet** button.
2. Under **1 · Connection**, choose **Via proxy (recommended)**.
3. Paste your Worker URL into the **Cloudflare Worker URL** field.
4. Fill in the rest as usual, click **Copy snippet**, and paste it into your Rise **Embed › Code** block.

The status will read **"Ready — no credentials in this snippet." 🔒** — that's your confirmation the key is no longer in the course.

---

## Troubleshooting

**Nothing arrives in the LRS**
Turn on **"Log to browser console"** in the extension, publish, and open your browser's console (F12) while viewing the course. The snippet reports what happened.

**You see "Origin not allowed" (403)**
`ALLOWED_ORIGINS` doesn't match your LMS address. It must be the address learners actually see in the browser bar. Include `https://`, and no trailing slash.

**You see "Proxy not configured" (500)**
A variable is missing or misspelled in Step 4. Names are case‑sensitive. Re‑check and click **Deploy** again.

**You see "Rate limit exceeded" (429)**
More than 60 statements a minute from one learner. If that's expected, add a variable `RATE_LIMIT_PER_MIN` with a higher number.

**"Could not reach the LRS" (502)**
`LRS_ENDPOINT` is wrong, or your LRS is down. Check the URL — it should be the base xAPI address; the proxy adds `/statements` for you.

---

## What the proxy protects you from (and what it doesn't)

**It does:**
- Keep your LRS credentials completely out of the course — nobody viewing the page can find them.
- Reject requests from any website other than the ones you listed.
- Limit how fast statements can be sent, and reject malformed data.

**It doesn't:**
- Hide the *statement data* itself (that still travels from the learner's browser — as it must).
- Stop someone who is logged into your LMS from sending statements through it. It stops *outsiders*, not authorised learners.

For most organisations this is exactly the right trade‑off: the credential — the thing that would let someone abuse your LRS — is safe.

---

## Keeping it healthy

- **Rotate credentials** as your policy requires: update the secrets in Step 4 and click Deploy. **You don't need to touch your published courses** — that's another benefit of the proxy.
- **Watch usage** under your Worker's **Metrics** tab.
- **Still use a write‑only LRS key** where you can. Defence in depth.
