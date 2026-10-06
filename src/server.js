/**
 * Server entry point.
 * Starts the Express app listening on the configured port.
 *
 * Run with: npm start  (loads .env via node --env-file)
 */

const app = require("./app");

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`[server] Factus WhatsApp Bot listening on port ${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
  console.log(`[server] Webhook: http://localhost:${PORT}/webhook`);
});
