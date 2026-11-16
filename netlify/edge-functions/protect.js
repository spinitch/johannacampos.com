// Password gate for the AI Patient Summarization case study.
//
// This runs on Netlify's edge, before anything is served, so the page and its
// screenshots never reach a browser that hasn't given the password. The
// password lives in a Netlify environment variable — never in this repo.
//
//   Netlify > Site configuration > Environment variables > CASE_STUDY_PASSWORD
//
// The browser asks for a username too; it is ignored, so anything works there.
// If the variable is missing the gate stays shut: a locked page is a far better
// failure than a confidential one served to everyone.

const REALM = 'Private case study';

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
    },
  });
}

export default async (request, context) => {
  const expected = Netlify.env.get('CASE_STUDY_PASSWORD');
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
      return response;
    }
  }

  return challenge('Authentication required.');
};

export const config = {
  path: ['/patient-summarization.html', '/assets/img/patient-summarization/*'],
};
