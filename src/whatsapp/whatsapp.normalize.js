/**
 * WhatsApp Normalization Helpers
 * Responsibility: pure, side-effect-free conversions between the two identifier
 * forms used by the transport, plus (later) inbound filtering and envelope
 * construction.
 *
 * These helpers are the property-testable core of the whatsapp-web.js migration:
 * no I/O, no library objects, just plain string/field access.
 *
 *   Chat_Id      "573001112233@c.us"  (whatsapp-web.js addressing)
 *   Phone_Number "573001112233"       (digits-only; Business_Flow conversation key)
 *
 * NOTE: `shouldProcess` (task 2.3) and `toWebhookEnvelope` (task 2.5) will be
 * added to this module and appended to the `module.exports` object below.
 */

// Individual-chat suffix used by whatsapp-web.js (contrast with groups: "@g.us").
const CHAT_ID_SUFFIX = "@c.us";

/**
 * Convert a whatsapp-web.js Chat_Id into a digits-only Phone_Number.
 *
 * Strips the trailing "@c.us" suffix if present. A value without the suffix is
 * returned unchanged, which keeps the function a clean inverse of
 * `phoneToChatId`.
 *
 *   chatIdToPhone("573001112233@c.us") -> "573001112233"
 *
 * @param {string} chatId - the whatsapp-web.js Chat_Id (e.g. "573001112233@c.us")
 * @returns {string} the digits-only Phone_Number
 */
function chatIdToPhone(chatId) {
  if (chatId.endsWith(CHAT_ID_SUFFIX)) {
    return chatId.slice(0, -CHAT_ID_SUFFIX.length);
  }
  return chatId;
}

/**
 * Convert a digits-only Phone_Number into a whatsapp-web.js Chat_Id.
 *
 * Appends the "@c.us" suffix. Idempotent: a value that already carries the
 * suffix is returned unchanged, so `phoneToChatId(phoneToChatId(p))` equals
 * `phoneToChatId(p)`.
 *
 *   phoneToChatId("573001112233")       -> "573001112233@c.us"
 *   phoneToChatId("573001112233@c.us")  -> "573001112233@c.us"
 *
 * @param {string} phoneNumber - the digits-only Phone_Number (or an already-suffixed Chat_Id)
 * @returns {string} the whatsapp-web.js Chat_Id
 */
function phoneToChatId(phoneNumber) {
  // Already a fully-qualified id (any WhatsApp domain: "@c.us", "@lid",
  // "@g.us", ...). Return as-is so we never stack a second suffix. This is what
  // makes replying to a @lid-addressed chat work: the handler passes the
  // original `message.from` straight through as the outbound destination.
  if (typeof phoneNumber === "string" && phoneNumber.includes("@")) {
    return phoneNumber;
  }
  return `${phoneNumber}${CHAT_ID_SUFFIX}`;
}

// whatsapp-web.js type discriminator for a plain text message (contrast with
// the Meta Cloud API vocabulary, where the equivalent is "text").
const TEXT_MESSAGE_TYPE = "chat";

// Chat_Id domains that are NOT individual 1-to-1 chats and must be ignored:
// groups ("@g.us"), broadcast lists ("@broadcast") and status updates
// ("status@broadcast"). Individual chats arrive as "<number>@c.us" or, under
// WhatsApp's newer privacy addressing, "<linked-id>@lid".
const NON_INDIVIDUAL_SUFFIXES = ["@g.us", "@broadcast"];

// The Meta vocabulary the unchanged controller expects on the normalized
// envelope (receiveMessage checks `message.type === "text"`).
const META_TEXT_TYPE = "text";

/**
 * Whether a Chat_Id addresses an individual (1-to-1) chat.
 *
 * Rather than allow-listing individual-chat suffixes (which breaks whenever
 * WhatsApp introduces a new addressing scheme — as it did with "@lid"), we
 * BLOCK-list the non-individual domains. Any id that is not a group ("@g.us")
 * nor a broadcast/status ("@broadcast") is treated as an individual chat. This
 * accepts both the classic "<number>@c.us" and the newer privacy addressing
 * "<linked-id>@lid".
 *
 * @param {string} [chatId] - the whatsapp-web.js Chat_Id
 * @returns {boolean} true iff the id is an individual chat
 */
function isIndividualChat(chatId) {
  if (typeof chatId !== "string" || chatId.length === 0) {
    return false;
  }
  return !NON_INDIVIDUAL_SUFFIXES.some((suffix) => chatId.endsWith(suffix));
}

/**
 * Decide whether an inbound whatsapp-web.js message should be processed by the
 * Business_Flow.
 *
 * Returns `true` only for an inbound, individual-chat text message:
 *   - it is a plain text message (`type === 'chat'`), AND
 *   - it is not a self-echo (`fromMe === false`), AND
 *   - it comes from an individual chat (NOT a group/broadcast/status).
 *
 * The individual-chat guard is essential: group messages (`from` ending in
 * "@g.us") also have `type === 'chat'`, so without it a group message would
 * pass the filter and its group id would flow into the Business_Flow as the
 * conversation key — producing an invalid outbound reply. Individual chats may
 * be addressed as "@c.us" OR "@lid" (WhatsApp privacy addressing); both are
 * accepted. Groups, broadcasts and status updates are filtered out here.
 *
 *   shouldProcess({ type: "chat",  fromMe: false, from: "5730...@c.us" }) -> true
 *   shouldProcess({ type: "chat",  fromMe: false, from: "2254...@lid"  }) -> true
 *   shouldProcess({ type: "chat",  fromMe: true,  from: "5730...@c.us" }) -> false  (self-echo)
 *   shouldProcess({ type: "image", fromMe: false, from: "5730...@c.us" }) -> false  (non-text)
 *   shouldProcess({ type: "chat",  fromMe: false, from: "1203...@g.us" }) -> false  (group)
 *
 * @param {{ type?: string, fromMe?: boolean, from?: string }} message - the inbound message
 * @returns {boolean} true iff the message is inbound individual-chat text
 */
function shouldProcess(message) {
  return (
    message.type === TEXT_MESSAGE_TYPE &&
    message.fromMe === false &&
    isIndividualChat(message.from)
  );
}

/**
 * Build the Meta-shaped webhook envelope that the unchanged `receiveMessage`
 * controller expects, from an already-normalized Phone_Number and text body.
 *
 * The controller extracts the message via
 * `payload.entry[0].changes[0].value.messages[0]` and then reads
 * `message.from`, `message.type` (expecting `"text"`), and `message.text.body`.
 * This builder sets `from` to the digits-only Phone_Number (keeping the
 * conversation key stable) and `type` to the Meta vocabulary `"text"`.
 *
 * @param {string} phoneNumber - the digits-only Phone_Number (conversation key)
 * @param {string} text - the message text body
 * @returns {object} the Meta-shaped webhook envelope
 */
function toWebhookEnvelope(phoneNumber, text) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phoneNumber,
                  type: META_TEXT_TYPE,
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

module.exports = {
  chatIdToPhone,
  phoneToChatId,
  shouldProcess,
  toWebhookEnvelope,
};
