/**
 * Express application setup.
 * Configures middleware and routes but does NOT start listening.
 * Keeping this separate from server.js makes the app importable for tests.
 */

const express = require("express");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

// Parse incoming JSON bodies (WhatsApp webhooks are JSON).
app.use(express.json());

// Health check - handy to confirm the server is up (and for tunnels like ngrok).
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "factus-whatsapp-bot" });
});

// WhatsApp webhook routes (GET verification + POST messages).
app.use("/", whatsappRoutes);

module.exports = app;
