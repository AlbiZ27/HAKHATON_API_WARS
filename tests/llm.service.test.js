// tests/llm.service.test.js
//
// Real assertions for the LLM/conversation pipeline using node:test.
// Run with: npm test
//
// These cover the pure, deterministic core of the WhatsApp bot: message
// interpretation, intent detection, confirmation parsing and the invoice
// summary. The actual send to Meta is NOT tested here (it needs credentials).

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  processMessage,
  validateConfirmation,
  extractInvoiceFromSingleMessage,
  buildInvoiceSummary,
  detectIntent,
} = require("../src/services/llm.service");

// --- Single-message extraction ------------------------------------------

test("extractInvoiceFromSingleMessage parses a complete invoice", () => {
  const msg =
    "Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50000 cada una, pagó en efectivo.";
  const invoice = extractInvoiceFromSingleMessage(msg);

  assert.equal(invoice.customer.identification, "1234567890");
  assert.equal(invoice.customer.name, "Juan Pérez");
  assert.ok(invoice.items && invoice.items.length >= 1);
  assert.equal(invoice.items[0].quantity, 2);
  assert.equal(invoice.items[0].price, 50000);
  assert.equal(invoice.payment.method, "efectivo");
});

// --- Intent detection ----------------------------------------------------

test("detectIntent recognizes help, cancel and invoice start", () => {
  assert.equal(detectIntent("ayuda"), "HELP");
  assert.equal(detectIntent("help"), "HELP");
  assert.equal(detectIntent("cancelar"), "CANCEL");
  assert.equal(detectIntent("factura a Juan"), "START_INVOICE");
});

// --- Confirmation parsing ------------------------------------------------

test("validateConfirmation accepts affirmative replies", () => {
  assert.equal(validateConfirmation("Sí").confirmed, true);
  assert.equal(validateConfirmation("si").confirmed, true);
  assert.equal(validateConfirmation("OK").confirmed, true);
});

test("validateConfirmation detects cancellation", () => {
  assert.equal(validateConfirmation("No").cancelled, true);
  assert.equal(validateConfirmation("cancelar").cancelled, true);
});

test("validateConfirmation flags unrecognized replies as invalid", () => {
  assert.equal(validateConfirmation("quizás mañana").invalid, true);
});

// --- Invoice summary -----------------------------------------------------

test("buildInvoiceSummary includes customer, product and total", () => {
  const invoice = {
    customer: { identification: "1234567890", name: "Juan Pérez" },
    items: [{ description: "Camiseta negra", quantity: 2, price: 50000 }],
    payment: { method: "efectivo" },
  };
  const summary = buildInvoiceSummary(invoice, 119000);

  assert.match(summary, /Juan Pérez/);
  assert.match(summary, /1234567890/);
  assert.match(summary, /Camiseta negra/);
  assert.match(summary, /119.000/); // locale-formatted total
});

// --- Full message processing (conversational entry points) ---------------

test("processMessage returns a help response for HELP intent", async () => {
  const result = await processMessage("ayuda");
  assert.match(result.response, /factura/i);
  assert.equal(result.nextStep, "START");
});

test("processMessage starts the invoice flow on START_INVOICE", async () => {
  const result = await processMessage("quiero una factura");
  assert.equal(result.nextStep, "WAITING_FOR_CUSTOMER_ID");
});

test("processMessage cancels on CANCEL intent", async () => {
  const result = await processMessage("cancelar");
  assert.equal(result.cancelled, true);
  assert.equal(result.nextStep, "START");
});
