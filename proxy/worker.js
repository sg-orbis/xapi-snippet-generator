/**
 * xAPI Proxy Worker
 * -----------------
 * Sits between your published course and your LRS so the LRS credential
 * NEVER appears in the course (and therefore never reaches the learner's
 * browser, the LMS page, or anyone viewing source).
 *
 * The course POSTs a statement here with no credentials. This Worker adds
 * the real Authorization header from its stored secrets and forwards the
 * statement to the LRS.
 *
 * Required settings (set in the Cloudflare dashboard):
 *   LRS_ENDPOINT     e.g. https://lrs.example.com/xapi/        (Variable)
 *   ALLOWED_ORIGINS  e.g. https://learn.cybersight.org         (Variable)
 *                    comma separated; "*.example.org" wildcards allowed
 * Then EITHER basic auth:
 *   LRS_KEY          your LRS key / username                   (Secret)
 *   LRS_SECRET       your LRS secret / password                (Secret)
 * OR a token:
 *   LRS_TOKEN        a bearer token / JWT                      (Secret)
 *
 * Optional:
 *   RATE_LIMIT_PER_MIN   default 60, per client IP
 *   MAX_BODY_BYTES       default 102400 (100 KB)
 */

const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_MAX_BODY = 102400;

// In-memory sliding window. Per isolate, so it is a sane safety valve
// rather than a strict global guarantee.
const hits = new Map();

function parseList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function originAllowed(origin, allowed) {
  if (!allowed.length) return false;
  if (!origin) return false;
  let host;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const entry of allowed) {
    if (entry === "*") return true;
    let pat = entry;
    // accept full URLs or bare hostnames in the config
    if (pat.includes("://")) {
      try { pat = new URL(pat).hostname.toLowerCase(); } catch { /* keep as-is */ }
    }
    if (pat.startsWith("*.")) {
      const base = pat.slice(2);
      if (host === base || host.endsWith("." + base)) return true;
    } else if (host === pat) {
      return true;
    }
  }
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Experience-API-Version",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

function rateLimited(ip, limit) {
  const now = Date.now();
  const windowStart = now - 60000;
  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  list.push(now);
  hits.set(ip, list);
  // opportunistic cleanup so the map cannot grow without bound
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || v[v.length - 1] < windowStart) hits.delete(k);
    }
  }
  return list.length > limit;
}

/** Basic shape check so the proxy cannot be used to relay arbitrary payloads. */
function validStatement(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return "not an object";
  if (!s.actor || typeof s.actor !== "object") return "missing actor";
  if (!s.verb || typeof s.verb !== "object" || !s.verb.id) return "missing verb.id";
  if (!s.object || typeof s.object !== "object" || !s.object.id) return "missing object.id";
  return null;
}

export default {
  async fetch(request, env) {
    const allowed = parseList(env.ALLOWED_ORIGINS);
    const origin = request.headers.get("Origin") || "";
    const isAllowed = originAllowed(origin, allowed);

    // ---- Preflight ----
    if (request.method === "OPTIONS") {
      if (!isAllowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ---- Health check (reveals no secrets) ----
    if (request.method === "GET") {
      return json(
        {
          ok: true,
          service: "xapi-proxy",
          configured: Boolean(
            env.LRS_ENDPOINT && (env.LRS_TOKEN || (env.LRS_KEY && env.LRS_SECRET))
          ),
          allowedOriginCount: allowed.length,
        },
        200,
        isAllowed ? origin : ""
      );
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, isAllowed ? origin : "");
    }

    // ---- Origin allowlist ----
    if (!isAllowed) {
      return json({ error: "Origin not allowed" }, 403, "");
    }

    // ---- Config sanity ----
    if (!env.LRS_ENDPOINT) {
      return json({ error: "Proxy not configured: LRS_ENDPOINT missing" }, 500, origin);
    }
    let auth;
    if (env.LRS_TOKEN) {
      auth = /^(bearer|jwt)\s+/i.test(env.LRS_TOKEN)
        ? env.LRS_TOKEN
        : "Bearer " + env.LRS_TOKEN;
    } else if (env.LRS_KEY && env.LRS_SECRET) {
      auth = "Basic " + btoa(`${env.LRS_KEY}:${env.LRS_SECRET}`);
    } else {
      return json({ error: "Proxy not configured: no LRS credentials" }, 500, origin);
    }

    // ---- Rate limit ----
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const limit = Number(env.RATE_LIMIT_PER_MIN || DEFAULT_RATE_LIMIT);
    if (rateLimited(ip, limit)) {
      return json({ error: "Rate limit exceeded" }, 429, origin);
    }

    // ---- Body ----
    const maxBody = Number(env.MAX_BODY_BYTES || DEFAULT_MAX_BODY);
    const raw = await request.text();
    if (raw.length > maxBody) {
      return json({ error: "Payload too large" }, 413, origin);
    }

    let statement;
    try {
      statement = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    // Accept a single statement or an array of them.
    const list = Array.isArray(statement) ? statement : [statement];
    if (!list.length) return json({ error: "Empty statement" }, 400, origin);
    for (const s of list) {
      const problem = validStatement(s);
      if (problem) return json({ error: `Invalid statement: ${problem}` }, 400, origin);
    }

    // ---- Forward to the LRS ----
    const target = env.LRS_ENDPOINT.replace(/\/+$/, "") + "/statements";
    let lrsResponse;
    try {
      lrsResponse = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Experience-API-Version":
            request.headers.get("X-Experience-API-Version") || "1.0.3",
          Authorization: auth,
        },
        body: JSON.stringify(statement),
      });
    } catch (e) {
      return json({ error: "Could not reach the LRS" }, 502, origin);
    }

    const text = await lrsResponse.text();
    return new Response(text, {
      status: lrsResponse.status,
      headers: {
        "Content-Type":
          lrsResponse.headers.get("Content-Type") || "application/json",
        ...corsHeaders(origin),
      },
    });
  },
};
