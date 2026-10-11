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

const { sendMessage, isReady } = require("../whatsapp/whatsapp.client");
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

module.exports = {
  sendTextMessage,
};
