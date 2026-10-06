/**
 * Gemini Service
 * Responsibility: a thin, self-contained client for Google's Gemini REST API,
 * used as a FALLBACK invoice-data extractor when the regex engine in
 * llm.service.js cannot build a complete invoice from a free-text message.
 *
 * Design notes:
 *   - Uses Node's built-in global fetch (Node >= 20) — no SDK, no new deps.
 *   - Hard timeout so a slow/overloaded API never blocks the WhatsApp reply;
 *     on timeout or any error the caller degrades gracefully to the existing
 *     step-by-step conversational flow.
 *   - Returns the SAME invoice shape the internal model uses
 *     ({ customer, items, payment }) so it drops straight into processMessage.
 */

// Model and key come from the environment. The default model is a currently
// available one (the 2.x flash family has been retired for new keys).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Max time we are willing to wait for Gemini before giving up and letting the
// caller fall back to the conversational flow. The free tier can spike to
// 20-30s under load, which is unacceptable for a chat reply.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 8000);

// Instruction constraining Gemini to emit ONLY the invoice JSON we expect.
const SYSTEM_INSTRUCTION = [
  "Eres un extractor de datos de facturas para un bot de WhatsApp en Colombia.",
  "Dado un mensaje en español, extrae la información de la factura.",
  "Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicación) con esta forma:",
  '{"customer":{"identification":string|null,"name":string|null},',
  '"items":[{"description":string,"quantity":number,"price":number|null}],',
  '"payment":{"method":string|null}}',
  "Si un dato no aparece en el mensaje, usa null. Normaliza precios como números",
  '(ej: "50 mil" -> 50000, "50.000" -> 50000). No inventes datos.',
].join(" ");

/**
 * Whether the Gemini fallback is configured (an API key is present).
 * @returns {boolean}
 */
function isGeminiConfigured() {
  return typeof GEMINI_API_KEY === "string" && GEMINI_API_KEY.length > 0;
}

function buildUrl() {
  return (
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
  );
}

function buildBody(message) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  };
}

/**
 * Normalize whatever Gemini returns into the internal invoice shape, coercing
 * numeric fields and guarding against missing branches. Returns null when the
 * payload cannot be understood.
 *
 * @param {any} parsed - the JSON object parsed from Gemini's text response
 * @returns {{customer: object, items: object[], payment: object}|null}
 */
function normalizeInvoice(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const customer = parsed.customer ?? {};
  const payment = parsed.payment ?? {};
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  const items = rawItems
    .map((item) => ({
      description:
        typeof item?.description === "string" ? item.description.trim() : null,
      quantity: toNumberOrNull(item?.quantity),
      price: toNumberOrNull(item?.price),
    }))
    // Drop entries with no usable description at all.
    .filter((item) => item.description);

  return {
    customer: {
      identification:
        customer.identification != null ? String(customer.identification).trim() : null,
      name: typeof customer.name === "string" ? customer.name.trim() : null,
    },
    items,
    payment: {
      method: typeof payment.method === "string" ? payment.method.trim() : null,
    },
  };
}

/** Coerce a value to a finite number, or null. */
function toNumberOrNull(value) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Ask Gemini to extract invoice data from a free-text message.
 *
 * Never throws: on timeout, network error, HTTP error, or unparseable output it
 * returns null so the caller can fall back to the conversational flow.
 *
 * @param {string} text - the user's free-text message
 * @returns {Promise<{customer: object, items: object[], payment: object}|null>}
 */
async function extractInvoiceWithGemini(text) {
  if (!isGeminiConfigured()) {
    console.warn("[gemini.service] GEMINI_API_KEY not set; skipping Gemini fallback");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(buildUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(text)),
      signal: controller.signal,
    });

    const elapsed = Date.now() - started;

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[gemini.service] HTTP ${res.status} after ${elapsed}ms: ${detail.slice(0, 200)}`
      );
      return null;
    }

    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      console.error("[gemini.service] empty response text");
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[gemini.service] response was not valid JSON:", raw.slice(0, 200));
      return null;
    }

    console.log(`[gemini.service] extraction succeeded in ${elapsed}ms`);
    return normalizeInvoice(parsed);
  } catch (error) {
    const elapsed = Date.now() - started;
    if (error.name === "AbortError") {
      console.warn(`[gemini.service] timed out after ${GEMINI_TIMEOUT_MS}ms (elapsed ${elapsed}ms)`);
    } else {
      console.error(`[gemini.service] request failed after ${elapsed}ms:`, error.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractInvoiceWithGemini,
  isGeminiConfigured,
  normalizeInvoice,
};
