/**
 * WhatsApp_Client wrapper
 * Responsibility: own the single long-lived `whatsapp-web.js` Client instance,
 * drive its authentication/connection lifecycle, expose a readiness flag, and
 * provide a thin outbound send delegate.
 *
 * This module is the process-resident replacement for the old HTTP transport:
 * instead of receiving Meta webhooks and POSTing to the Graph API, a persistent
 * client authenticates once via QR (session persisted by `LocalAuth`), emits
 * `message` events for inbound traffic, and sends replies via `client.sendMessage`.
 *
 * Lifecycle state vocabulary (Requirement 6.2):
 *   uninitialized -> initializing -> qr_pending -> authenticated -> ready
 *                                                               \-> disconnected
 *
 * Logging convention: every transition logs one line prefixed `[whatsapp.client]`.
 */
const path = require('path');
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// --- Module-level state ------------------------------------------------------

// The single whatsapp-web.js Client instance, created by initializeClient().
let client = null;

// Current lifecycle state; exposed to /health via getClientState(). Starts as
// "uninitialized" until initializeClient() constructs the client.
let lifecycleState = "uninitialized";

// --- Configuration -----------------------------------------------------------
// Session_Store identity and location (Requirement 7.4). Both read from the
// environment with documented defaults.
const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || "factus-bot";
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || "./.wwebjs_auth";

// Puppeteer launch flags for a headless Chromium (Requirement 7.3). The sandbox
// flags are required to run under many containerized/root environments.
const PUPPETEER_OPTIONS = {
  headless: true,
  args: [ 
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Ayuda a reducir el consumo de memoria en Render
        '--disable-gpu'],
};

// --- Internal helpers --------------------------------------------------------

/**
 * Transition the lifecycle state and log the transition once (Requirement 6.2).
 *
 * @param {string} nextState - the new lifecycle state
 * @param {string} [detail] - optional human-readable detail appended to the log
 */
function setState(nextState, detail) {
  lifecycleState = nextState;
  if (detail) {
    console.log(`[whatsapp.client] lifecycle -> ${nextState} (${detail})`);
  } else {
    console.log(`[whatsapp.client] lifecycle -> ${nextState}`);
  }
}

// --- Public API --------------------------------------------------------------

/**
 * Report the current WhatsApp_Client lifecycle state (Requirement 6.5).
 *
 * @returns {string} the current lifecycle state
 */
function getClientState() {
  return lifecycleState;
}

/**
 * Whether the WhatsApp_Client is ready to send outbound messages
 * (Requirement 2.4). True only when the lifecycle state is "ready".
 *
 * @returns {boolean} true iff the client has reached the ready state
 */
function isReady() {
  return lifecycleState === "ready";
}

/**
 * Construct and initialize the WhatsApp_Client, wiring its lifecycle events
 * (Requirements 2.1, 2.2, 2.3, 3.2, 3.4, 6.1, 6.2, 6.4) and routing inbound
 * `message` events to the injected handler.
 *
 * Session persistence is handled by `LocalAuth` (Requirement 3.1): when a valid
 * session exists under `dataPath`, the library emits `authenticated` -> `ready`
 * without a `qr` event; when it is missing or corrupt, it emits `qr` and the
 * normal QR flow runs (Requirement 3.4).
 *
 * @param {{ onMessage?: function }} [options] - inbound message handler
 * @returns {import("whatsapp-web.js").Client} the initialized client
 */
function initializeClient({ onMessage } = {}) {
  setState("initializing");

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: CLIENT_ID,
      dataPath: SESSION_PATH,
    }),
    puppeteer: PUPPETEER_OPTIONS,
  });

  // QR pending: render the pairing code to the terminal for scanning (Req 2.1).
  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    setState("qr_pending", "scan the QR code with WhatsApp > Linked Devices");
  });

  // Authenticated: session accepted; session state is being persisted (Req 3.2).
  client.on("authenticated", () => {
    setState("authenticated");
  });

  // Auth failure: log and fall back to a fresh QR; the library re-emits `qr`
  // (Requirement 2.3).
  client.on("auth_failure", (message) => {
    console.error(`[whatsapp.client] authentication failure: ${message}`);
    setState("qr_pending", "authentication failed, awaiting new QR");
  });

  // Ready: the client can now send and receive (Requirements 2.2, 6.2).
  client.on("ready", () => {
    setState("ready");
  });

  // Disconnected: log the reason and attempt to reconnect (Requirement 6.4).
  client.on("disconnected", (reason) => {
    setState("disconnected", `reason: ${reason}`);
    client.initialize();
  });

  // Route inbound messages to the injected handler (Requirement 6.1). Only wire
  // when a handler is provided so the wrapper stays usable in isolation/tests.
  if (onMessage) {
    client.on("message", onMessage);
  }

  client.initialize();
  return client;
}

/**
 * Send an outbound message by delegating to the underlying library client
 * (Requirements 5.1, 2.4). The service-layer readiness gate lives in
 * `whatsapp.service.js`; this wrapper simply forwards to the library.
 *
 * The `content` may be a plain text string or a `MessageMedia` instance (used to
 * deliver the invoice PDF). The optional `options` object is forwarded verbatim
 * to the library — e.g. `{ caption }` when sending media. Both extra arguments
 * are backward compatible: existing text sends keep calling `sendMessage(chatId, body)`.
 *
 * @param {string} chatId - the whatsapp-web.js Chat_Id (e.g. "573001112233@c.us")
 * @param {string|import("whatsapp-web.js").MessageMedia} content - text body or media
 * @param {object} [options] - options forwarded to client.sendMessage (e.g. { caption })
 * @returns {Promise<import("whatsapp-web.js").Message>} the sent message
 */
async function sendMessage(chatId, content, options) {
  return client.sendMessage(chatId, content, options);
}

/**
 * Resolve a Chat_Id that is safe to send MEDIA to.
 *
 * WhatsApp's privacy addressing delivers some senders as "<linked-id>@lid".
 * Sending plain text to a "@lid" works, but sending media currently fails deep
 * inside whatsapp-web.js ("Data passed to getter must include an id property ...
 * but got undefined") because the library cannot resolve the chat/contact model
 * from a "@lid". This helper tries to turn a "@lid" into the classic
 * "<number>@c.us" id, which the media path can handle:
 *
 *   1. look up the Contact behind the "@lid" (getContactById)
 *   2. read its real phone number (Contact.number)
 *   3. validate/normalize it back into a wid via getNumberId
 *
 * On any failure (or for non-"@lid" ids) it returns the original id unchanged,
 * so the caller can still attempt the send and fall back as needed. Never throws.
 *
 * @param {string} chatId - the inbound Chat_Id (may be "@c.us" or "@lid")
 * @returns {Promise<string>} a Chat_Id to use for the media send
 */
async function resolveSendableChatId(chatId) {
  if (typeof chatId !== "string" || !chatId.endsWith("@lid")) {
    return chatId;
  }

  try {
    const contact = await client.getContactById(chatId);
    const number = contact?.number;
    if (!number) {
      console.warn(
        `[whatsapp.client] no number resolved for ${chatId}; using original id`
      );
      return chatId;
    }

    const wid = await client.getNumberId(number);
    const resolved = wid?._serialized;
    if (!resolved) {
      console.warn(
        `[whatsapp.client] number ${number} not registered; using original id`
      );
      return chatId;
    }

    console.log(`[whatsapp.client] resolved ${chatId} -> ${resolved} for media`);
    return resolved;
  } catch (error) {
    console.warn(
      `[whatsapp.client] failed to resolve ${chatId} for media: ${error.message}`
    );
    return chatId;
  }
}

module.exports = {
  initializeClient,
  sendMessage,
  resolveSendableChatId,
  getClientState,
  isReady,
};
