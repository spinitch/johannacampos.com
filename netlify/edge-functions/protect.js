// Password gate for the AI Patient Summarization case study.
//
// This runs on Netlify's edge, before anything is served, so the page and its
// screenshots never reach a browser that hasn't given the password. The
// password lives in a Netlify environment variable — never in this repo.
//
//   Netlify > Site configuration > Environment variables > CASE_STUDY_PASSWORD
//   Set it for ALL deploy contexts, or branch deploys stay locked.
//
// The browser asks for a username too; it is ignored, so anything works there.
//
// Everything here fails closed. If the variable is missing, if the runtime
// hands us something unexpected, if this code throws — the answer is 401. A
// locked page is a far better failure than a confidential one served to
// everyone, and `onError: 'fail'` below stops Netlify falling through to the
// static file when an edge function errors, which is its default.

const REALM = 'Private case study';

// Netlify exposes env through its own global; Deno.env is the older spelling.
// Either may be missing, so try both and treat a throw as "no value".
function readPassword() {
  try {
    if (typeof Netlify !== 'undefined' && Netlify?.env?.get) {
      const v = Netlify.env.get('CASE_STUDY_PASSWORD');
      if (v) return v;
    }
  } catch { /* fall through */ }
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      const v = Deno.env.get('CASE_STUDY_PASSWORD');
      if (v) return v;
    }
  } catch { /* fall through */ }
  return null;
}

// Compares in constant time so the response time can't be used to guess the
// password one character at a time.
function matches(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Fold any length difference into the result rather than returning early,
  // then always walk the longer of the two.
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function challenge(message) {
  return new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
      // Never let a proxy or the browser cache a protected response.
      'Cache-Control': 'no-store',
      // Lets us confirm from the outside that this gate actually ran.
      'X-Case-Study-Gate': 'locked',
    },
  });
}

export default async (request, context) => {
  try {
    const expected = readPassword();
    if (!expected) {
      return challenge('This page is not available. (CASE_STUDY_PASSWORD is not set.)');
    }

    const header = request.headers.get('authorization') ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      let decoded = '';
      try {
        decoded = atob(encoded);
      } catch {
        return challenge('Authentication required.');
      }
      // "username:password" — the username is ignored, and a password may
      // itself contain colons, so split on the first one only.
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (matches(password, expected)) {
        const response = await context.next();
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('X-Case-Study-Gate', 'unlocked');
        return response;
      }
    }

    return challenge('Authentication required.');
  } catch {
    return challenge('Authentication required.');
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
  // Netlify's default on an edge-function error is to bypass it and serve the
  // origin file. For this page that would publish the thing we are hiding.
  onError: 'fail',
};
