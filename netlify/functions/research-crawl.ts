/**
 * Eagle Vision — Research Crawl
 *
 * Fetches a URL and returns cleaned text content.
 * Optimized for maximum content extraction (investment research use case).
 * max_chars default: 20000 (was 15000, was 8000) — V4: maximise content extraction for investment research.
 */
import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { url, max_chars = 20000 } = body;

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'url required' }),
      };
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Invalid URL', url }),
      };
    }

    // Fetch with generous timeout — accuracy > speed
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EagleVision/3.0; +https://eagle-vision.io/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          url,
          error: `HTTP ${response.status}`,
          text: '',
          title: '',
          description: '',
          elapsed_ms: Date.now() - startTime,
        }),
      };
    }

    // Check content type — accept HTML and plain text
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html') && !contentType.includes('text/plain')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          url,
          error: `Non-text content type: ${contentType.split(';')[0]}`,
          text: '',
          title: '',
          description: '',
          elapsed_ms: Date.now() - startTime,
        }),
      };
    }

    const html = await response.text();

    // ── HTML → Text extraction ──────────────────────────────────────────────
    // Strategy: preserve semantic structure by converting block elements to newlines
    // before stripping tags. This gives Claude better paragraph context.

    let text = html;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = metaMatch ? metaMatch[1].trim() : '';

    // Remove entire <script>, <style>, <noscript>, <svg>, <canvas> blocks first
    text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    text = text.replace(/<canvas[\s\S]*?<\/canvas>/gi, ' ');
    text = text.replace(/<head[\s\S]*?<\/head>/gi, ' ');

    // Remove navigation and footer boilerplate
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
    text = text.replace(/<header[\s\S]*?<\/header>/gi, ' ');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

    // Convert block-level elements to newlines (preserve paragraph structure)
    text = text.replace(/<\/?(p|div|article|section|li|h[1-6]|br|hr|blockquote|pre|td|th|tr)[^>]*>/gi, '\n');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ');

    // Normalize whitespace: collapse multiple spaces, normalize multiple newlines
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    // Remove very short lines (nav items, button labels) — keep lines > 20 chars
    // But preserve structure by not being too aggressive
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      // Keep empty lines for paragraph breaks
      if (trimmed.length === 0) return true;
      // Keep lines with meaningful content (> 20 chars OR look like headings)
      return trimmed.length > 20 || /^[A-Z][^a-z]*$/.test(trimmed);
    });
    text = filteredLines.join('\n');

    // Final whitespace cleanup
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!text || text.length < 100) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          url,
          error: 'Insufficient text content extracted',
          text: '',
          title,
          description,
          elapsed_ms: Date.now() - startTime,
        }),
      };
    }

    // Cap at max_chars — V4: allow up to 25000 chars per page (orchestrator CFG.MAX_CRAWL_CHARS = 20000)
    const cap = Math.min(max_chars, 25000);
    const finalText = text.slice(0, cap);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        url,
        text: finalText,
        title,
        description,
        chars_extracted: text.length,
        chars_returned: finalText.length,
        truncated: text.length > cap,
        elapsed_ms: Date.now() - startTime,
      }),
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        url: '',
        error: isTimeout ? 'Crawl timed out' : (err?.message || 'Crawl failed'),
        text: '',
        title: '',
        description: '',
        elapsed_ms: Date.now() - startTime,
      }),
    };
  }
};

export { handler };
