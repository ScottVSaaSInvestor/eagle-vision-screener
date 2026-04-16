import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { content_base64, filename, content_type } = body;

    if (!content_base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No content provided' }) };
    }

    const buffer = Buffer.from(content_base64, 'base64');

    if (content_type?.includes('pdf') || filename?.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfParse = require('pdf-parse');
        const result = await pdfParse(buffer);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            text: result.text?.slice(0, 20000) || '',
            page_count: result.numpages || 0,
            filename,
          }),
        };
      } catch (pdfErr) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            text: '',
            filename,
            error: 'PDF parse failed',
          }),
        };
      }
    }

    // Plain text or DOCX (simplified — return as-is if text)
    if (
      content_type?.includes('text') ||
      filename?.toLowerCase().endsWith('.txt')
    ) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          text: buffer.toString('utf-8').slice(0, 20000),
          filename,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        text: '',
        filename,
        error: `Unsupported file type: ${content_type || filename}`,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err?.message || 'Parse error' }),
    };
  }
};

export { handler };
