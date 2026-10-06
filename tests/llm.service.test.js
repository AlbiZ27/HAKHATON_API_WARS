/**
 * Tests para el servicio LLM
 */

const { processMessage, validateConfirmation, extractInvoiceFromSingleMessage, buildInvoiceSummary, detectIntent } = require("../src/services/llm.service");
const { validateInvoice, calculateTotal } = require("../src/models/invoice.model");

// Test de extracción de datos de un mensaje único
console.log("\n=== Test: Extracción de datos de mensaje único ===");

const testMessage1 = "Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo.";
const invoice1 = extractInvoiceFromSingleMessage(testMessage1);
console.log("Mensaje:", testMessage1);
console.log("Invoice extraído:", JSON.stringify(invoice1, null, 2));
console.log("Validación:", validateInvoice(invoice1));

const testMessage2 = "Factura a María López, NIT 8001234567, 5 pantalones azules a 120000 cada uno, pago con tarjeta.";
const invoice2 = extractInvoiceFromSingleMessage(testMessage2);
console.log("\nMensaje:", testMessage2);
console.log("Invoice extraído:", JSON.stringify(invoice2, null, 2));
console.log("Validación:", validateInvoice(invoice2));

// Test de cálculo de total
console.log("\n=== Test: Cálculo de total ===");
console.log("Total invoice1 (19% IVA):", calculateTotal(invoice1, 19));
console.log("Total invoice2 (19% IVA):", calculateTotal(invoice2, 19));

// Test de resumen de factura
console.log("\n=== Test: Resumen de factura ===");
console.log(buildInvoiceSummary(invoice1, calculateTotal(invoice1, 19)));

// Test de validación de confirmación
console.log("\n=== Test: Validación de confirmación ===");
console.log("Sí:", validateConfirmation("Sí"));
console.log("si:", validateConfirmation("si"));
console.log("OK:", validateConfirmation("OK"));
console.log("No:", validateConfirmation("No"));
console.log("cancelar:", validateConfirmation("cancelar"));
console.log("Random:", validateConfirmation("algo aleatorio"));

// Test de detección de intención
console.log("\n=== Test: Detección de intención ===");
console.log("Factura a Juan:", detectIntent("Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo."));
console.log("ayuda:", detectIntent("ayuda"));
console.log("help:", detectIntent("help"));
console.log("cancelar:", detectIntent("cancelar"));
console.log("sí:", detectIntent("sí, confirmo"));
console.log("no:", detectIntent("no, cancelo"));

// Test de procesamiento de mensaje completo
console.log("\n=== Test: Procesamiento de mensaje completo ===");

async function testMessageProcessing() {
  // Test 1: Mensaje completo
  console.log("\n--- Test 1: Mensaje completo ---");
  const result1 = await processMessage(testMessage1);
  console.log("Resultado:", JSON.stringify(result1, null, 2));

  // Test 2: Mensaje incompleto (solo cliente)
  console.log("\n--- Test 2: Mensaje incompleto ---");
  const result2 = await processMessage("Factura a Carlos Ruiz, CC 1000000000");
  console.log("Resultado:", JSON.stringify(result2, null, 2));

  // Test 3: Ayuda
  console.log("\n--- Test 3: Ayuda ---");
  const result3 = await processMessage("ayuda");
  console.log("Resultado:", JSON.stringify(result3, null, 2));

  // Test 4: Cancelar
  console.log("\n--- Test 4: Cancelar ---");
  const result4 = await processMessage("cancelar");
  console.log("Resultado:", JSON.stringify(result4, null, 2));
}

testMessageProcessing().catch(console.error);