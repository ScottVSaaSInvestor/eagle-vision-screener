
async function adapt(handler, req, res) {
  try {
    let rawBody = null;
    if (req.body !== undefined && req.body !== null) {
      rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    const headers = {};
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = Array.isArray(v) ? v[0] : (v || '');
      }
    }
    const event = {
      httpMethod: (req.method || 'GET').toUpperCase(),
      body: rawBody,
      headers,
      path: req.url || '/',
      queryStringParameters: req.query || {},
    };
    const result = await handler(event);
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }
    if (!res.getHeader('Content-Type') && !res.getHeader('content-type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.status(result.statusCode).send(result.body);
  } catch (err) {
    console.error('[api] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
}


// Bundled function: auth-check
let _netlifyExports = {};
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/auth-check.ts
var auth_check_exports = {};
__export(auth_check_exports, {
  handler: () => handler
});
_netlifyExports = __toCommonJS(auth_check_exports);
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { passcode } = body;
    if (!passcode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Passcode required" })
      };
    }
    const serverPasscode = process.env.ACCESS_PASSCODE;
    if (!serverPasscode) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "Server not configured" })
      };
    }
    const success = passcode === serverPasscode;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success })
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Internal error" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (_netlifyExports = {
  handler
});


const _netlifyHandler = (_netlifyExports && (_netlifyExports.handler || _netlifyExports.default)) || null;

// Vercel API route export
module.exports = async function vercelHandler(req, res) {
  if (!_netlifyHandler) {
    res.status(500).json({ error: 'Handler not found in bundle', bundle: 'auth-check' });
    return;
  }
  await adapt(_netlifyHandler, req, res);
};
module.exports.config = { maxDuration: 300 };
