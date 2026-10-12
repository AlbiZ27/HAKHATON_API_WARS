/**
 * WhatsApp Service
 * Responsibility: send messages to users through the WhatsApp_Client
 * (`whatsapp-web.js`). This is the OUTBOUND channel. The rest of the app decides
 * WHAT to say; this module knows HOW to deliver it to the linked WhatsApp account.
 *
 * This replaces the former Meta WhatsApp Cloud API sender: there is no Graph API
 * `fetch`, no API version constant, and no Meta credential validation. Outbound
 * delivery now flows through the process-resident client:
 *
 *   sendTextMessage(to, body)
 *     -> gate on client readiness (Requirement 2.4)
 *     -> phoneToChatId(to)        (Requirement 5.2)
 *     -> client.sendMessage(...)  (Requirement 5.1)
 *
 * Logging convention: all logs are prefixed `[whatsapp.service]` and an
 * outbound failure log includes the target Phone_Number (Requirement 5.4).
 */

const { MessageMedia } = require("whatsapp-web.js");
const {
  sendMessage,
  isReady,
  resolveSendableChatId,
} = require("../whatsapp/whatsapp.client");
const { phoneToChatId } = require("../whatsapp/whatsapp.normalize");

/**
 * Send a plain text message to a WhatsApp user through the WhatsApp_Client.
 *
 * Readiness-gated: when the client is not ready (any lifecycle state other than
 * `ready`), the reply is dropped with a warning and nothing is sent
 * (Requirement 2.4). Otherwise the digits-only Phone_Number is converted to a
 * Chat_Id and delegated to the client (Requirements 5.1, 5.2). On send failure
 * the error is logged with the target Phone_Number and rethrown (Requirement 5.4).
 *
 * @param {string} to - recipient digits-only Phone_Number (conversation key)
 * @param {string} body - message text
 * @returns {Promise<object|undefined>} the sent message, or undefined when the
 *   client is not ready and the reply is dropped
 */
async function sendTextMessage(to, body) {
  if (!isReady()) {
    console.warn(
      `[whatsapp.service] Client not ready; dropping reply to ${to}`
    );
    return;
  }

  const chatId = phoneToChatId(to);

  try {
    return await sendMessage(chatId, body);
  } catch (error) {
    console.error(
      `[whatsapp.service] Failed to send to ${to}: ${error.message}`
    );
    throw error;
  }
}

/**
 * Send a document (e.g. the invoice PDF) to a WhatsApp user as an attachment.
 *
 * Same readiness gate and Phone_Number → Chat_Id conversion as
 * `sendTextMessage`. Builds a `MessageMedia` from a Base64 payload and delegates
 * to the client with an optional caption. On failure the error is logged with
 * the target Phone_Number and rethrown so the caller can decide how to degrade
 * (Requirement 5.4).
 *
 * @param {string} to - recipient digits-only Phone_Number (conversation key)
 * @param {object} document - the attachment to send
 * @param {string} document.base64 - the file content encoded in Base64
 * @param {string} document.filename - the file name shown to the user
 * @param {string} [document.mimetype="application/pdf"] - the file MIME type
 * @param {string} [document.caption] - optional text shown with the attachment
 * @returns {Promise<object|undefined>} the sent message, or undefined when the
 *   client is not ready and the attachment is dropped
 */
async function sendDocumentMessage(
  to,
  { base64, filename, mimetype = "application/pdf", caption } = {}
) {
  if (!isReady()) {
    console.warn(
      `[whatsapp.service] Client not ready; dropping document to ${to}`
    );
    return;
  }

  if (!base64) {
    console.warn(
      `[whatsapp.service] No base64 content provided; nothing to send to ${to}`
    );
    return;
  }

  // Media sends fail for "@lid" recipients in current whatsapp-web.js, so try to
  // resolve a "@c.us" id the media path can actually handle. Falls back to the
  // original id when it cannot be resolved.
  const chatId = await resolveSendableChatId(phoneToChatId(to));
  const media = new MessageMedia(mimetype, base64, filename);

  try {
    return await sendMessage(chatId, media, caption ? { caption } : undefined);
  } catch (error) {
    console.error(
      `[whatsapp.service] Failed to send document to ${to}: ${error.message}`
    );
    throw error;
  }
}

module.exports = {
  sendTextMessage,
  sendDocumentMessage,
};
