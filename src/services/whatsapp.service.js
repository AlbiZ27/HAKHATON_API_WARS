/**
 * WhatsApp Service
 * Responsibility: send messages to users through the Meta WhatsApp Cloud API.
 *
 * This is the OUTBOUND channel. The rest of the app decides WHAT to say;
 * this module knows HOW to deliver it to Meta.
 *
 * Meta Cloud API reference:
 *   POST https://graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages
 *   headers: Authorization: Bearer {ACCESS_TOKEN}, Content-Type: application/json
 *   body: { messaging_product: "whatsapp", to, type: "text", text: { body } }
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

/**
 * Reads and validates the WhatsApp credentials from the environment.
 * Fails fast with a clear message if something is missing.
 */
function getConfig() {
  const config = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing WhatsApp configuration in environment: ${missing.join(", ")}`
    );
  }

  return config;
}

/**
 * Sends a plain text message to a WhatsApp user.
 * @param {string} to - recipient phone number (as received from the webhook)
 * @param {string} body - message text
 * @returns {Promise<object>} the Meta API response
 */
async function sendTextMessage(to, body) {
  const { accessToken, phoneNumberId } = getConfig();
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    // Log the technical detail; the caller decides how to react.
    console.error(
      `[whatsapp.service] Failed to send message to ${to} (HTTP ${response.status}):`,
      JSON.stringify(data)
    );
    throw new Error(`WhatsApp send failed (HTTP ${response.status})`);
  }

  return data;
}

module.exports = { sendTextMessage };
