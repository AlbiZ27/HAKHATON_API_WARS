/**
 * Express application setup.
 * Configures middleware and routes but does NOT start listening.
 * Keeping this separate from server.js makes the app importable for tests.
 *
 * After the whatsapp-web.js migration the HTTP surface shrinks to just the
 * health probe: the Meta `/webhook` routes are gone (inbound traffic now
 * arrives via WhatsApp_Client `message` events), so `/health` is the only
 * endpoint and it reports the current WhatsApp_Client lifecycle state.
 */

const express = require("express");
const { getClientState } = require("./whatsapp/whatsapp.client");
const { getPdf } = require("./services/pdf-store.service");

const app = express();

// Parse incoming JSON bodies.
app.use(express.json());

// Health check - confirms the server is up and reports the WhatsApp_Client
// lifecycle state (Requirement 6.5).
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "factus-whatsapp-bot",
    whatsapp: getClientState(),
  });
});

// Invoice PDF download. When sending the PDF as a WhatsApp attachment is not
// possible (whatsapp-web.js media bug on "@lid" chats), the bot gives the user a
// link to this route instead. The token maps to an in-memory PDF (pdf-store).
app.get("/invoices/:token.pdf", (req, res) => {
  const pdf = getPdf(req.params.token);
  if (!pdf) {
    res.status(404).json({ status: "not_found", message: "PDF no disponible o expirado." });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${pdf.filename}"`
  );
  res.send(pdf.buffer);
});

module.exports = app;
