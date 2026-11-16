// Password gate for the AI Patient Summarization case study.
//
// Runs on Netlify's edge, before anything is served, so the page and its
// screenshots never reach a browser that hasn't given the password. The
// password lives in a Netlify environment variable — never in this repo.
//
//   Netlify > Site configuration > Environment variables > CASE_STUDY_PASSWORD
//   Set it for ALL deploy contexts, or branch deploys stay locked.
//
// How it works: an unauthenticated request for the page gets a styled login
// form instead. A correct password is answered with a cookie holding an expiry
// and an HMAC of that expiry, keyed on the password itself — so the cookie
// can't be forged without knowing the password, and changing the password
// invalidates every cookie already issued. Requests for the screenshots are
// checked against the same cookie.
//
// Everything fails closed: a missing variable, an unexpected runtime, or a
// throw anywhere all end in a locked page. `onError: 'fail'` below stops
// Netlify serving the static file when an edge function errors, which is its
// default and would publish exactly what this is hiding.

const COOKIE = 'cs_access';
const MAX_AGE = 60 * 60 * 24 * 7; // a week
const enc = new TextEncoder();

// Netlify exposes env through its own global; Deno.env is the older spelling.
// Either may be missing, so try both and treat a throw as "no value".
// Trimmed, and the submitted password is trimmed to match: a value pasted into
// Netlify's UI very easily picks up a trailing newline, and a password that
// depends on invisible whitespace is a trap rather than a security measure.
function readPassword() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify?.env?.get) {
      const v = Netlify.env.get('CASE_STUDY_PASSWORD');
      if (v && v.trim()) return v.trim();
    }
  } catch { /* fall through */ }
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      const v = Deno.env.get('CASE_STUDY_PASSWORD');
      if (v && v.trim()) return v.trim();
    }
  } catch { /* fall through */ }
  return null;
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// Constant time, so neither the password nor a signature can be guessed a
// character at a time from how long the comparison takes.
function equal(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

async function hasValidCookie(request, secret) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return false;
  const expiry = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;
  return equal(signature, await sign(expiry, secret));
}

function loginPage({ error = false, configured = true } = {}) {
  const message = !configured
    ? '<p class="note">This page isn’t available yet.</p>'
    : error
      ? '<p class="error" role="alert">That password didn’t work.</p>'
      : '<p class="note">This case study is shared privately.</p>';
  const form = configured ? `
      <form method="POST" autocomplete="off">
        <label for="p">Password</label>
        <input id="p" name="password" type="password" required autofocus
               autocomplete="current-password" spellcheck="false">
        <button type="submit">View case study</button>
      </form>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>AI Patient Summarization — Johanna Campos</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:grid;place-items:center;padding:24px;
    background:#F8F7F4;color:#1A1A2E;
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    -webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:380px;background:#fff;padding:40px 36px 36px;text-align:center}
  .eyebrow{font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#E8624A}
  h1{font-size:23px;font-weight:600;line-height:1.3;margin:10px 0 0}
  .note,.error{font-size:14.5px;line-height:1.6;color:#737373;margin-top:12px}
  .error{color:#C0392B}
  form{margin-top:26px;text-align:left}
  label{display:block;font-size:11px;font-weight:600;letter-spacing:.14em;
    text-transform:uppercase;color:#202020;margin-bottom:7px}
  input{width:100%;padding:13px 14px;font:inherit;font-size:16px;color:#1A1A2E;
    background:#fff;border:1px solid #D9D7D2;border-radius:0}
  input:focus{outline:2px solid #E8624A;outline-offset:1px;border-color:transparent}
  button{width:100%;margin-top:16px;padding:15px 24px;border:0;cursor:pointer;
    background:#1A1A2E;color:#F8F7F4;font:inherit;font-size:12px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;transition:background .2s}
  button:hover{background:#E8624A}
  .back{display:inline-block;margin-top:24px;font-size:13px;color:#737373}
  .back:hover{color:#E8624A}
  @media (max-width:420px){.card{padding:32px 24px 28px}}
</style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">Selected Work</p>
    <h1>AI Patient Summarization</h1>
    ${message}${form}
    <a class="back" href="/">← Back to johannacampos.com</a>
  </main>
</body>
</html>`;
}

const htmlResponse = (body, status) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Case-Study-Gate': 'locked',
  },
});

// A missing cookie on an image is not a person who can be shown a form.
const wantsHtml = (request) =>
  request.headers.get('sec-fetch-dest') === 'document' ||
  (request.headers.get('accept') ?? '').includes('text/html');

const deny = (request, opts) => wantsHtml(request)
  ? htmlResponse(loginPage(opts), 401)
  : new Response('Not available.', {
      status: 401,
      headers: { 'Cache-Control': 'no-store', 'X-Case-Study-Gate': 'locked' },
    });

export default async (request, context) => {
  try {
    const secret = readPassword();
    if (!secret) return deny(request, { configured: false });

    // Submitting the form.
    if (request.method === 'POST') {
      let supplied = '';
      try {
        supplied = String((await request.formData()).get('password') ?? '').trim();
      } catch { /* treated as a wrong password below */ }

      if (!equal(supplied, secret)) {
        return deny(request, { error: true });
      }
      const expiry = String(Date.now() + MAX_AGE * 1000);
      const cookie = `${expiry}.${await sign(expiry, secret)}`;
      return new Response(null, {
        status: 303,
        headers: {
          Location: new URL(request.url).pathname,
          'Set-Cookie': `${COOKIE}=${cookie}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (!(await hasValidCookie(request, secret))) return deny(request);

    const response = await context.next();
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Case-Study-Gate', 'unlocked');
    return response;
  } catch {
    return deny(request);
  }
};

export const config = {
  // Both spellings: Netlify can serve and link the page without its extension,
  // and a path that isn't listed here is a path that isn't protected.
  path: [
    '/patient-summarization.html',
    '/patient-summarization',
    '/assets/img/patient-summarization/*',
  ],
  onError: 'fail',
};
