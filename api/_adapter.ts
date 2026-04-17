/**
 * Vercel ↔ Netlify Handler Adapter
 *
 * All our business logic is written in Netlify's Handler format:
 *   handler(event) → { statusCode, headers, body }
 *
 * Vercel API routes use (req: VercelRequest, res: VercelResponse).
 * Vercel automatically parses the JSON body into req.body.
 * This adapter bridges the two formats cleanly.
 */

type NetlifyEvent = {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  path?: string;
};

type NetlifyResult = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

type NetlifyHandler = (event: NetlifyEvent) => Promise<NetlifyResult>;

// Vercel passes req/res as plain objects — use 'any' to avoid
// needing @vercel/node installed (it's provided at runtime by Vercel)
export function adapt(handler: NetlifyHandler) {
  return async (req: any, res: any) => {
    try {
      // Vercel already parses JSON body into req.body
      // Re-stringify it so Netlify handlers can JSON.parse(event.body)
      let rawBody: string | null = null;
      if (req.body !== undefined && req.body !== null) {
        rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      // Normalise headers — Vercel gives us an object, Netlify expects Record<string,string>
      const headers: Record<string, string> = {};
      if (req.headers) {
        for (const [k, v] of Object.entries(req.headers)) {
          headers[k] = Array.isArray(v) ? v[0] : (v as string) || '';
        }
      }

      const event: NetlifyEvent = {
        httpMethod: (req.method || 'GET').toUpperCase(),
        body: rawBody,
        headers,
        path: req.url || '/',
        queryStringParameters: req.query || {},
      };

      const result = await handler(event);

      // Set response headers
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }
      // Default content-type
      if (!res.getHeader('Content-Type') && !res.getHeader('content-type')) {
        res.setHeader('Content-Type', 'application/json');
      }

      res.status(result.statusCode).send(result.body);
    } catch (err: any) {
      console.error('[adapter] Unhandled error:', err?.message || err);
      res.status(500).json({ error: 'Internal server error', detail: err?.message });
    }
  };
}
