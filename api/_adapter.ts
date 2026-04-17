/**
 * Vercel ↔ Netlify Handler Adapter
 *
 * All our business logic is written in Netlify's Handler format:
 *   handler(event) → { statusCode, headers, body }
 *
 * This adapter wraps any Netlify handler to work as a Vercel API route:
 *   (req, res) => void
 *
 * This means we never have to rewrite the 14 function files — just wrap them.
 */
import type { IncomingMessage, ServerResponse } from 'http';

type NetlifyHandler = (event: {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  path?: string;
}) => Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}>;

export function adapt(handler: NetlifyHandler) {
  return async (req: IncomingMessage & { body?: any }, res: ServerResponse) => {
    // Read body
    let rawBody = '';
    if (req.body) {
      // Body already parsed by Vercel
      rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } else {
      // Read from stream
      await new Promise<void>((resolve) => {
        req.on('data', (chunk: Buffer) => { rawBody += chunk.toString(); });
        req.on('end', resolve);
      });
    }

    // Build Netlify-style event
    const event = {
      httpMethod: (req.method || 'GET').toUpperCase(),
      body: rawBody || null,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v || '')])
      ),
      path: req.url || '/',
      queryStringParameters: {},
    };

    // Call the Netlify handler
    const result = await handler(event);

    // Send response
    res.statusCode = result.statusCode;
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }
    if (!result.headers?.['Content-Type'] && !result.headers?.['content-type']) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(result.body);
  };
}
