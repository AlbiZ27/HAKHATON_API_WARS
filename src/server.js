/**
 * Server entry point.
 * Initializes the WhatsApp_Client and starts the Express app listening on the
 * configured port.
 *
 * Run with: npm start  (loads .env via node --env-file)
 */

const app = require("./app");
const { initializeClient } = require("./whatsapp/whatsapp.client");
const { handleInboundMessage } = require("./whatsapp/whatsapp.handler");

const PORT = process.env.PORT ?? 3000;

// Initialize the WhatsApp_Client before serving so inbound `message` events are
// wired before the process starts accepting traffic (Requirement 6.1). The
// client holds open handles (Puppeteer) and conversation.service registers a
// keep-alive timer at import time, so the process stays alive (Requirement 6.3).
initializeClient({ onMessage: handleInboundMessage });

app.listen(PORT, () => {
  console.log(`[server] Factus WhatsApp Bot listening on port ${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});
