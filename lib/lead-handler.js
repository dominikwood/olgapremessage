const MAX_BODY_BYTES = 10000;

function reply(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function bodyError(status, code) {
  return Object.assign(new Error(code), { status, code });
}

function parseBody(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : typeof value === "string" ? value : JSON.stringify(value);
  if (Buffer.byteLength(text || "", "utf8") > MAX_BODY_BYTES) throw bodyError(413, "body_too_large");
  let payload;
  try { payload = JSON.parse(text || "{}"); } catch { throw bodyError(400, "invalid_json"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw bodyError(400, "invalid_payload");
  return payload;
}

async function readBody(request) {
  if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) throw bodyError(413, "body_too_large");
  // Vercel may provide parsed JSON; the local HTTP server provides a stream.
  let body;
  try { body = request.body; } catch { throw bodyError(400, "invalid_json"); }
  if (body !== undefined) return parseBody(body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(bodyError(413, "body_too_large"));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
      try { resolve(parseBody(Buffer.concat(chunks))); } catch (error) { reject(error); }
    });
    request.on("error", () => reject(bodyError(400, "invalid_request")));
    request.on("aborted", () => reject(bodyError(400, "invalid_request")));
  });
}

function isSameOrigin(request) {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host.toLowerCase() === String(request.headers.host || "").toLowerCase();
  } catch { return false; }
}

function normalizeLead(payload) {
  for (const key of ["name", "phone", "message", "language", "source", "website"]) {
    if (payload[key] !== undefined && typeof payload[key] !== "string") throw bodyError(400, "invalid_fields");
  }
  const line = (value, limit) => (value || "").replace(/[\r\n]/g, " ").trim().slice(0, limit);
  return {
    name: line(payload.name, 120),
    phone: line(payload.phone, 80),
    message: (payload.message || "").trim().slice(0, 800),
    language: ["uk", "ru"].includes(payload.language) ? payload.language : "uk",
    source: line(payload.source || "course", 80),
    website: (payload.website || "").trim()
  };
}

function createLeadHandler({ env = process.env, fetchImpl = (...args) => fetch(...args) } = {}) {
  return async function handleLead(request, response) {
    if (request.method !== "POST") return reply(response, 405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
    if (!isSameOrigin(request)) return reply(response, 403, { ok: false, error: "origin_not_allowed" });
    const type = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (type !== "application/json") return reply(response, 415, { ok: false, error: "json_required" });

    try {
      const lead = normalizeLead(await readBody(request));
      // A honeypot is only a basic filter; production rate limits belong in Vercel WAF.
      if (lead.website) return reply(response, 200, { ok: true });
      if (!lead.name || !lead.phone) return reply(response, 400, { ok: false, error: "required_fields" });

      const token = env.TELEGRAM_BOT_TOKEN?.trim();
      const chatId = env.TELEGRAM_CHAT_ID?.trim();
      if (!token || !chatId) return reply(response, 503, { ok: false, error: "telegram_not_configured" });

      const message = [
        "Новая заявка с сайта Olga Prem",
        "",
        `Имя: ${lead.name}`,
        `Телефон: ${lead.phone}`,
        `Язык сайта: ${lead.language}`,
        `Кнопка: ${lead.source}`,
        lead.message ? `Комментарий: ${lead.message}` : ""
      ].filter(Boolean).join("\n");

      const upstream = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000)
      });
      if (!upstream.ok) return reply(response, 502, { ok: false, error: "telegram_error" });
      const result = await upstream.json();
      if (result?.ok !== true) return reply(response, 502, { ok: false, error: "telegram_error" });
      return reply(response, 200, { ok: true });
    } catch (error) {
      if (error.status && error.code) return reply(response, error.status, { ok: false, error: error.code });
      if (["TimeoutError", "AbortError"].includes(error.name)) return reply(response, 504, { ok: false, error: "telegram_timeout" });
      // Do not log enquiry contents, bot tokens or upstream error bodies.
      return reply(response, 502, { ok: false, error: "telegram_error" });
    }
  };
}

module.exports = { handleLead: createLeadHandler(), createLeadHandler };
