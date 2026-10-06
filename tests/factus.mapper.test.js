// tests/factus.mapper.test.js
//
// Unit tests for the Factus mapper using Node's native test runner (node:test).
// Run with: npm test  (which runs `node --test`)
//
// Tests live under tests/ so src/ stays clean with production code only.
// The mapper is pure, so these tests need no network, token, or env setup.

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { toFactusBill, computeTotal } = require("../src/factus/factus.mapper");

// A representative internal invoice, like the project doc example:
// "Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una".
function sampleInvoice() {
  return {
    customer: { identification: "1234567890", name: "Juan Pérez" },
    items: [{ description: "Camiseta negra", quantity: 2, price: 50000 }],
    payment: { method: "efectivo" },
  };
}

test("toFactusBill maps customer identity correctly", () => {
  const bill = toFactusBill(sampleInvoice());
  assert.equal(bill.customer.identification, "1234567890");
  assert.equal(bill.customer.names, "Juan Pérez");
});

test("toFactusBill maps each item with required Factus fields", () => {
  const bill = toFactusBill(sampleInvoice());
  assert.equal(bill.items.length, 1);

  const item = bill.items[0];
  assert.equal(item.name, "Camiseta negra");
  assert.equal(item.quantity, "2");
  assert.equal(item.price, "50000.00");
  assert.ok(Array.isArray(item.taxes));
  assert.equal(item.taxes[0].code, "01");
});

test("toFactusBill always generates a unique reference_code", () => {
  const first = toFactusBill(sampleInvoice());
  const second = toFactusBill(sampleInvoice());
  assert.ok(first.reference_code.startsWith("FACT-"));
  assert.notEqual(first.reference_code, second.reference_code);
});

test("toFactusBill includes a single payment_details entry with the total", () => {
  const bill = toFactusBill(sampleInvoice());
  assert.equal(bill.payment_details.length, 1);
  // 2 * 50000 = 100000, plus 19% IVA = 119000.00 (matches doc example total).
  assert.equal(bill.payment_details[0].amount, "119000.00");
});

test("toFactusBill uses a valid tribute code", () => {
  const bill = toFactusBill(sampleInvoice());
  assert.equal(bill.customer.tribute_code, "ZZ");
});

test("computeTotal applies the default tax rate", () => {
  const items = [{ quantity: 2, price: 50000 }];
  assert.equal(computeTotal(items), "119000.00");
});

test("computeTotal sums multiple items correctly", () => {
  const items = [
    { quantity: 1, price: 10000 },
    { quantity: 3, price: 20000 },
  ];
  // Subtotal 70000, +19% = 83300.00 (matches official Factus example).
  assert.equal(computeTotal(items), "83300.00");
});
