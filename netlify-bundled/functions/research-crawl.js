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

// netlify/functions/research-crawl.ts
var research_crawl_exports = {};
__export(research_crawl_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(research_crawl_exports);
var handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const startTime = Date.now();
  try {
    const body = JSON.parse(event.body || "{}");
    const { url, max_chars = 2e4 } = body;
    if (!url || typeof url !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "url required" })
      };
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Invalid URL", url })
      };
    }
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EagleVision/3.0; +https://eagle-vision.io/bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache"
      },
      signal: AbortSignal.timeout(15e3),
      redirect: "follow"
    });
    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          url,
          error: `HTTP ${response.status}`,
          text: "",
          title: "",
          description: "",
          elapsed_ms: Date.now() - startTime
        })
      };
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text/plain")) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          url,
          error: `Non-text content type: ${contentType.split(";")[0]}`,
          text: "",
          title: "",
          description: "",
          elapsed_ms: Date.now() - startTime
        })
      };
    }
    const html = await response.text();
    let text = html;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = metaMatch ? metaMatch[1].trim() : "";
    text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    text = text.replace(/<canvas[\s\S]*?<\/canvas>/gi, " ");
    text = text.replace(/<head[\s\S]*?<\/head>/gi, " ");
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
    text = text.replace(/<header[\s\S]*?<\/header>/gi, " ");
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    text = text.replace(/<\/?(p|div|article|section|li|h[1-6]|br|hr|blockquote|pre|td|th|tr)[^>]*>/gi, "\n");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ").replace(/&ndash;/g, "\u2013").replace(/&mdash;/g, "\u2014").replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'").replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"').replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ");
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.trim();
    const lines = text.split("\n");
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true;
      return trimmed.length > 20 || /^[A-Z][^a-z]*$/.test(trimmed);
    });
    text = filteredLines.join("\n");
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text.length < 100) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          url,
          error: "Insufficient text content extracted",
          text: "",
          title,
          description,
          elapsed_ms: Date.now() - startTime
        })
      };
    }
    const cap = Math.min(max_chars, 25e3);
    const finalText = text.slice(0, cap);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        url,
        text: finalText,
        title,
        description,
        chars_extracted: text.length,
        chars_returned: finalText.length,
        truncated: text.length > cap,
        elapsed_ms: Date.now() - startTime
      })
    };
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.message?.includes("timeout") || err?.message?.includes("aborted");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        url: "",
        error: isTimeout ? "Crawl timed out" : err?.message || "Crawl failed",
        text: "",
        title: "",
        description: "",
        elapsed_ms: Date.now() - startTime
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
