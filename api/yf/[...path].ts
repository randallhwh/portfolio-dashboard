// Vercel serverless function: proxies /api/yf/* → https://query2.finance.yahoo.com/*
// Replaces the Vite dev-server proxy, which only runs locally.
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const yfPath = (req.url as string).replace(/^\/api\/yf/, '');
  const target = `https://query2.finance.yahoo.com${yfPath}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://finance.yahoo.com',
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(body);
  } catch (err) {
    console.error('[yf-proxy] fetch error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
}
