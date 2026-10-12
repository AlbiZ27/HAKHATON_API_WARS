/**
 * PDF Store Service
 * Responsibility: keep invoice PDFs available over HTTP so the bot can hand the
 * user a download link when sending the file as a WhatsApp attachment is not
 * possible (a known whatsapp-web.js media bug, notably for "@lid" chats).
 *
 * The PDF bytes come from Factus as Base64. We stash them in memory keyed by a
 * short random token and expose them via GET /invoices/:token.pdf (wired in
 * app.js). Entries expire after a TTL so memory does not grow unbounded — the
 * link is only meant to live long enough for the user to tap it.
 *
 * This is deliberately a simple in-memory store: good enough for a single-process
 * bot and a hackathon demo. For horizontal scaling it would move to disk or an
 * object store, but the public contract (store -> token, get(token) -> pdf) stays.
 */

const crypto = require("node:crypto");

// token -> { base64, filename, expiresAt }
const store = new Map();

// How long a download link stays valid. Long enough for the user to open it,
// short enough that PDFs do not pile up in memory. Overridable via env.
const TTL_MS = Number(process.env.PDF_LINK_TTL_MS || 60 * 60 * 1000); // 1h

/**
 * Store a PDF and return a short token to build its download URL.
 *
 * @param {object} pdf - the PDF to store
 * @param {string} pdf.base64 - the PDF content encoded in Base64
 * @param {string} pdf.filename - the file name shown on download
 * @returns {string} a URL-safe token identifying the stored PDF
 */
function storePdf({ base64, filename }) {
  const token = crypto.randomBytes(12).toString("hex");
  store.set(token, {
    base64,
    filename: filename || `${token}.pdf`,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

/**
 * Retrieve a stored PDF by token, or null when it is missing or expired.
 *
 * @param {string} token - the token returned by storePdf
 * @returns {{buffer: Buffer, filename: string} | null}
 */
function getPdf(token) {
  const entry = store.get(token);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return {
    buffer: Buffer.from(entry.base64, "base64"),
    filename: entry.filename,
  };
}

/** Remove expired entries. Called periodically to bound memory. */
function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(token);
    }
  }
}

// Keep the store from growing without bound. `unref` so this timer never keeps
// the process alive on its own.
const timer = setInterval(cleanupExpired, 15 * 60 * 1000);
if (typeof timer.unref === "function") {
  timer.unref();
}

module.exports = { storePdf, getPdf, cleanupExpired };