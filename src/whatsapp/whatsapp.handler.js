/**
 * WhatsApp Message_Handler
 * Responsibility: the glue invoked on every inbound `message` event from the
 * WhatsApp_Client. It is intentionally thin — it delegates filtering and
 * normalization to the pure helpers in `whatsapp.normalize.js`, dispatches to
 * the UNCHANGED Business_Flow entry point `receiveMessage`, and routes the reply
 * back out through the outbound service.
 *
 *   handleInboundMessage(message)
 *     -> skip unless shouldProcess(message)      (Req 4.4 non-text, 4.5 self-echo)
 *     -> phoneNumber = chatIdToPhone(message.from) (Req 4.2)
 *     -> envelope = toWebhookEnvelope(phone, body) (Req 4.1, 4.3)
 *     -> receiveMessage(envelope)                 (Req 8.1 — unchanged contract)
 *     -> sendTextMessage(result.phoneNumber, result.response) (Req 5.1)
 *
 * Error handling follows the "transport never crashes the process" principle:
 * a Business_Flow error (or a failed reply) is logged and swallowed so that
 * subsequent `message` events keep flowing (Req 4.6).
 */

const { receiveMessage } = require("../controller/whatsapp.controller");
const { sendTextMessage } = require("../services/whatsapp.service");
const {
  shouldProcess,
  toWebhookEnvelope,
} = require("./whatsapp.normalize");

/**
 * Handle a single inbound whatsapp-web.js message.
 *
 * Filters out self-echoes and non-text messages, normalizes the remaining
 * inbound text into the Meta-shaped envelope the controller expects, invokes the
 * unchanged Business_Flow, and sends any resulting reply back to the user. Any
 * error raised by the Business_Flow or the reply dispatch is logged and
 * swallowed so message intake continues (Req 4.6).
 *
 * @param {{ from: string, type?: string, fromMe?: boolean, body?: string }} message
 *   the inbound whatsapp-web.js message
 * @returns {Promise<void>}
 */
async function handleInboundMessage(message) {
  // TEMP DIAGNOSTIC: log the raw inbound shape so we can see what arrives.
  console.log("[whatsapp.handler] inbound:", {
    from: message?.from,
    type: message?.type,
    fromMe: message?.fromMe,
    body: message?.body,
  });

  // Req 4.4 (non-text) + Req 4.5 (self-echo): ignore anything that is not
  // inbound text without touching the Business_Flow.
  if (!shouldProcess(message)) {
    console.log("[whatsapp.handler] skipped by shouldProcess (not inbound individual-chat text)");
    return;
  }

  // Use the original Chat_Id (`message.from`) as the conversation key AND the
  // outbound reply destination. We deliberately do NOT reduce it to a
  // digits-only number: under WhatsApp privacy addressing the sender arrives as
  // "<linked-id>@lid" whose real number is masked, so the only reliable way to
  // reply is to send back to the exact id we received. Passing the full id
  // through keeps the conversation key stable (Req 8.3) and the reply routable
  // for both "@c.us" and "@lid" chats (Req 4.2, 5.1, 5.2).
  const chatId = message.from;

  // Req 4.1, 4.3: reshape into the Meta-shaped envelope receiveMessage parses.
  const envelope = toWebhookEnvelope(chatId, message.body);

  try {
    // Req 8.1: invoke the unchanged Business_Flow entry point.
    const result = await receiveMessage(envelope);
    console.log("[whatsapp.handler] receiveMessage result:", result);

    // Req 5.1: when the flow produced a reply + target, send it back.
    if (result?.response && result?.phoneNumber) {
      await sendTextMessage(result.phoneNumber, result.response);
      console.log("[whatsapp.handler] reply sent to", result.phoneNumber);
    } else {
      console.log("[whatsapp.handler] no reply dispatched (missing response or phoneNumber)");
    }
  } catch (error) {
    // Req 4.6: log and swallow so subsequent messages keep flowing.
    console.error("[whatsapp.handler] Business flow error:", error);
  }
}

module.exports = {
  handleInboundMessage,
};
