/**
 * WhatsApp Routes
 * Exposes the webhook endpoints that Meta's Cloud API talks to.
 *
 *   GET  /webhook  -> verification handshake (Meta sends hub.challenge)
 *   POST /webhook  -> incoming messages from users
 */

const express = require("express");
const router = express.Router();

const { receiveMessage } = require("../controller/whatsapp.controller");
const { sendTextMessage } = require("../services/whatsapp.service");

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "factus-bot-verify";

/**
 * GET /webhook - Meta verification handshake.
 * Meta calls this once when you configure the webhook. We must echo back
 * hub.challenge only if the verify token matches ours.
 */
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[whatsapp.routes] Webhook verified by Meta");
    return res.status(200).send(challenge);
  }

  console.warn("[whatsapp.routes] Webhook verification failed");
  return res.sendStatus(403);
});

/**
 * POST /webhook - incoming messages.
 * We acknowledge Meta immediately with 200 (Meta retries otherwise), then
 * process the message and send the reply asynchronously.
 */
router.post("/webhook", async (req, res) => {
  // Acknowledge right away so Meta does not retry.
  res.sendStatus(200);

  try {
    const result = await receiveMessage(req.body);

    // If the controller produced a reply and we know who to answer, send it.
    if (result?.response && result?.phoneNumber) {
      await sendTextMessage(result.phoneNumber, result.response);
    }
  } catch (error) {
    console.error("[whatsapp.routes] Error handling incoming webhook:", error);
  }
});

module.exports = router;
