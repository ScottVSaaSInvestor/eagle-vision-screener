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
module.exports = __toCommonJS(auth_check_exports);
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
0 && (module.exports = {
  handler
});
