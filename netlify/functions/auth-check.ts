import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { passcode } = body;

    if (!passcode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Passcode required' }),
      };
    }

    const serverPasscode = process.env.ACCESS_PASSCODE;
    if (!serverPasscode) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Server not configured' }),
      };
    }

    const success = passcode === serverPasscode;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success }),
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal error' }),
    };
  }
};

export { handler };
