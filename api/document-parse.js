
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


// Bundled function: document-parse
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

// netlify/functions/document-parse.ts
var document_parse_exports = {};
__export(document_parse_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(document_parse_exports);
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { content_base64, filename, content_type } = body;
    if (!content_base64) {
      return { statusCode: 400, body: JSON.stringify({ error: "No content provided" }) };
    }
    const buffer = Buffer.from(content_base64, "base64");
    if (content_type?.includes("pdf") || filename?.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = require("pdf-parse");
        const result = await pdfParse(buffer);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: true,
            text: result.text?.slice(0, 2e4) || "",
            page_count: result.numpages || 0,
            filename
          })
        };
      } catch (pdfErr) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            text: "",
            filename,
            error: "PDF parse failed"
          })
        };
      }
    }
    if (content_type?.includes("text") || filename?.toLowerCase().endsWith(".txt")) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          text: buffer.toString("utf-8").slice(0, 2e4),
          filename
        })
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        text: "",
        filename,
        error: `Unsupported file type: ${content_type || filename}`
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err?.message || "Parse error" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});


// Vercel API route export
module.exports = async function handler(req, res) {
  await adapt(exports.handler, req, res);
};
module.exports.config = { maxDuration: 300 };
