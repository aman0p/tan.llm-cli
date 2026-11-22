import { Hono } from "hono";
import { getNeonAuthBaseUrl } from "../lib/neon-auth";

function toJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function page(title: string, body: string, script: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'" />
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0b10; color: #eee; display: flex; justify-content: center; padding: 2rem 1rem; }
  main { width: 100%; max-width: 26rem; background: #171722; border: 1px solid #2b2b3a; border-radius: 12px; padding: 2rem; }
  h1 { font-size: 1.35rem; margin-top: 0; }
  label { display: block; margin-top: 1rem; font-size: .85rem; color: #aaa; }
  input { box-sizing: border-box; width: 100%; padding: .6rem; margin-top: .3rem; background: #22222f; border: 1px solid #3a3a4d; border-radius: 6px; color: #fff; }
  button { margin-top: 1rem; padding: .6rem 1rem; background: #6c47ff; border: 0; border-radius: 6px; color: #fff; cursor: pointer; }
  button.secondary { background: #2b2b3a; margin-right: .5rem; }
  .social { display: flex; gap: .5rem; }
  .details { margin-top: 1rem; font-size: .85rem; color: #aaa; word-break: break-all; }
  #status { color: #ff8f8f; min-height: 1.25rem; margin-top: .75rem; }
  #debug { margin-top: 1rem; padding: .5rem; background: #0b0b10; border: 1px solid #2b2b3a; border-radius: 4px; font-family: monospace; font-size: .7rem; color: #8f8; max-height: 120px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
<main>${body}</main>
<script type="module">${script}</script>
</body>
</html>`;
}

function loginPage(issuer: string, oauthQuery: string) {
  const body = `
<h1 id="title">Sign in to tan.llm</h1>
<form id="email-form">
  <label id="name-label" style="display:none">Name<input id="name" type="text" autocomplete="name" /></label>
  <label>Email<input id="email" type="email" autocomplete="email" required /></label>
  <label>Password<input id="password" type="password" autocomplete="current-password" required /></label>
  <button type="submit" id="submit-button">Sign in</button>
</form>
<div class="social">
  <button class="secondary" data-provider="google">Google</button>
  <button class="secondary" data-provider="github">GitHub</button>
</div>
<div class="details"><button class="secondary" id="toggle-mode" type="button">Need an account? Sign up</button></div>
<div id="status"></div>
<div id="debug"></div>`;

  const script = `
const ISSUER = ${toJson(issuer)};
const OAUTH_QUERY = ${toJson(oauthQuery)};
const CALLBACK_URL = window.location.href;
const status = document.getElementById("status");
const debugEl = document.getElementById("debug");
let isSignUp = false;

function log(msg) {
  debugEl.textContent += msg + "\\n";
  console.log("[tan.llm Auth]", msg);
}

function toggleMode() {
  isSignUp = !isSignUp;
  document.getElementById("title").textContent = isSignUp ? "Create your tan.llm account" : "Sign in to tan.llm";
  document.getElementById("submit-button").textContent = isSignUp ? "Sign up" : "Sign in";
  document.getElementById("toggle-mode").textContent = isSignUp ? "Have an account? Sign in" : "Need an account? Sign up";
  document.getElementById("name-label").style.display = isSignUp ? "block" : "none";
  document.getElementById("name").required = isSignUp;
  document.getElementById("password").autocomplete = isSignUp ? "new-password" : "current-password";
  status.textContent = "";
  log("Mode: " + (isSignUp ? "signup" : "signin"));
}

document.getElementById("toggle-mode").addEventListener("click", toggleMode);

async function api(path, body) {
  log("POST " + path);
  const response = await fetch(ISSUER + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, oauth_query: OAUTH_QUERY }),
  });
  const data = await response.json().catch(() => ({}));
  log(path + " -> " + response.status + " " + JSON.stringify(data).slice(0, 200));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || data.message || "Request failed (" + response.status + ")");
  }
  return data;
}

async function resume() {
  const data = await api("/oauth2/continue", { selected: true });
  if (data.url) {
    log("Navigating to consent");
    window.location.assign(data.url);
  } else {
    log("ERROR: oauth2/continue returned no url");
  }
}

log("Page loaded. OAuth query length: " + OAUTH_QUERY.length);
log("Issuer: " + ISSUER);

window.addEventListener("DOMContentLoaded", async () => {
  log("DOMContentLoaded fired");
  try {
    const response = await fetch(ISSUER + "/get-session", { credentials: "include" });
    const session = await response.json().catch(() => ({}));
    log("get-session: " + response.status + " " + JSON.stringify(session).slice(0, 100));
    if (session?.user) {
      log("Existing session found, resuming");
      await resume();
    }
  } catch (e) {
    log("get-session error: " + e);
  }
});

document.getElementById("email-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  try {
    const credentials = {
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
    };
    log("Submitting " + (isSignUp ? "signup" : "signin") + " for " + credentials.email);
    const data = isSignUp
      ? await api("/sign-up/email", { ...credentials, name: document.getElementById("name").value || credentials.email.split("@")[0] })
      : await api("/sign-in/email", credentials);

    if (data.url) {
      log("Navigating to: " + data.url.slice(0, 100));
      window.location.assign(data.url);
    } else {
      log("No url in response, calling resume");
      await resume();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR: " + msg);
    status.textContent = msg;
  }
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    status.textContent = "";
    try {
      log("Social sign-in: " + button.dataset.provider);
      const data = await api("/sign-in/social", {
        provider: button.dataset.provider,
        callbackURL: CALLBACK_URL,
      });
      if (data.url) window.location.assign(data.url);
      else await resume();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log("ERROR: " + msg);
      status.textContent = msg;
    }
  });
});`;

  return page("Sign in to tan.llm", body, script);
}

function consentPage(issuer: string, oauthQuery: string) {
  const body = `
<h1>Authorize tan.llm CLI</h1>
<div class="details" id="client-name">Loading client details...</div>
<div class="details" id="request"></div>
<div class="details">This client runs on your machine. Only approve it if you started the login yourself.</div>
<div>
  <button class="secondary" id="deny">Deny</button>
  <button id="allow">Allow</button>
</div>
<div id="status"></div>
<div id="debug"></div>`;

  const script = `
const ISSUER = ${toJson(issuer)};
const OAUTH_QUERY = ${toJson(oauthQuery)};
const params = new URLSearchParams(window.location.search);
const status = document.getElementById("status");
const debugEl = document.getElementById("debug");

function log(msg) {
  debugEl.textContent += msg + "\\n";
  console.log("[tan.llm Auth]", msg);
}

log("Consent page loaded. Query length: " + OAUTH_QUERY.length);

document.getElementById("request").textContent =
  "Scopes: " + (params.get("scope") || "none") + "\\nResource: " + (params.get("resource") || "none") + "\\nRedirect: " + (params.get("redirect_uri") || "none");

const clientId = params.get("client_id");
if (clientId) {
  fetch(ISSUER + "/oauth2/public-client?client_id=" + encodeURIComponent(clientId), { credentials: "include" })
    .then((response) => response.json())
    .then((data) => {
      if (data?.client_name) document.getElementById("client-name").textContent = "Client: " + data.client_name;
    })
    .catch(() => {});
}

async function respond(accept) {
  status.textContent = "";
  try {
    log("POST oauth2/consent accept=" + accept);
    const response = await fetch(ISSUER + "/oauth2/consent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: OAUTH_QUERY }),
    });
    const data = await response.json().catch(() => ({}));
    log("consent -> " + response.status + " " + JSON.stringify(data).slice(0, 200));
    if (!response.ok) throw new Error(data.error_description || data.error || data.message || "Request failed");
    if (data.url) window.location.assign(data.url);
    else log("ERROR: consent returned no url");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR: " + msg);
    status.textContent = msg;
  }
}

document.getElementById("allow").addEventListener("click", () => respond(true));
document.getElementById("deny").addEventListener("click", () => respond(false));`;

  return page("Authorize tan.llm", body, script);
}

const app = new Hono()
  .get("/login", (c) => {
    const query = new URL(c.req.url).search.slice(1);
    return c.html(loginPage(getNeonAuthBaseUrl(), query));
  })
  .get("/consent", (c) => {
    const query = new URL(c.req.url).search.slice(1);
    return c.html(consentPage(getNeonAuthBaseUrl(), query));
  })
  .get("/callback", (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    if (error) {
      return c.text(errorDescription ?? error, 400);
    }

    if (!code || !state) {
      return c.text("Missing authorization code or state", 400);
    }

    try {
      const [encoded] = state.split(".");
      if (!encoded) throw new Error("Invalid state");

      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as { port?: unknown };
      if (!payload.port || typeof payload.port !== "number") {
        throw new Error("Invalid port in state");
      }

      const redirectUrl = `http://localhost:${payload.port}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      return c.redirect(redirectUrl);
    } catch {
      return c.text("Invalid authentication state", 400);
    }
  });

export default app;
