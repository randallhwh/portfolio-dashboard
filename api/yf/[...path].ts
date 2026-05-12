// Vercel serverless function: proxies /api/yf/* → https://query2.finance.yahoo.com/*
// Yahoo Finance requires a session cookie + crumb token — fetched once and cached per warm instance.
/* eslint-disable @typescript-eslint/no-explicit-any */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent':      UA,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/',
  'Origin':          'https://finance.yahoo.com',
};

// Module-level cache — survives across warm invocations of the same function instance
let authCache: { cookie: string; crumb: string; expires: number } | null = null;

async function getAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (authCache && authCache.expires > Date.now()) return authCache;

  try {
    // Step 1: hit Yahoo Finance home to get session cookies
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // Node 18+ fetch supports getSetCookie(); fall back to get() if unavailable
    const setCookies: string[] =
      (homeRes.headers as any).getSetCookie?.() ??
      (homeRes.headers.get('set-cookie') ? [homeRes.headers.get('set-cookie') as string] : []);
    const cookie = setCookies.map((c: string) => c.split(';')[0]).join('; ');

    // Step 2: exchange cookies for a crumb token
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookie, 'Referer': 'https://finance.yahoo.com/' },
    });

    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    // Sanity-check: crumb is a short alphanumeric string, not HTML
    if (!crumb || crumb.length > 20 || crumb.includes('<')) return null;

    authCache = { cookie, crumb, expires: Date.now() + 3_600_000 }; // cache 1 hour
    return { cookie, crumb };
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const yfPath = (req.url as string).replace(/^\/api\/yf/, '');

  try {
    const auth = await getAuth();

    const url = new URL(`https://query2.finance.yahoo.com${yfPath}`);
    if (auth?.crumb) url.searchParams.set('crumb', auth.crumb);

    const upstream = await fetch(url.toString(), {
      headers: {
        ...BROWSER_HEADERS,
        ...(auth ? { Cookie: auth.cookie } : {}),
      },
    });

    if (!upstream.ok) {
      console.error(`[yf-proxy] upstream ${upstream.status} for ${url.pathname}`);
      res.status(upstream.status).end();
      return;
    }

    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(body);
  } catch (err) {
    console.error('[yf-proxy] error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}
