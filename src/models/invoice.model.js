/**
 * Modelo interno de factura
 * Define la estructura de datos que se usa internamente antes de mapear a Factus
 */

/**
 * @typedef {Object} InvoiceItem
 * @property {string} description - Descripción del producto o servicio
 * @property {number} quantity - Cantidad del producto
 * @property {number} price - Precio unitario
 */

/**
 * @typedef {Object} InvoiceCustomer
 * @property {string} identification - Documento de identificación (CC, NIT, etc.)
 * @property {string} name - Nombre completo del cliente
 */

/**
 * @typedef {Object} InvoicePayment
 * @property {string} method - Método de pago (efectivo, tarjeta, transferencia, etc.)
 */

/**
 * @typedef {Object} Invoice
 * @property {InvoiceCustomer} customer - Datos del cliente
 * @property {InvoiceItem[]} items - Lista de productos o servicios
 * @property {InvoicePayment} payment - Detalles de pago
 */

/**
 * Valida que una factura tenga todos los campos obligatorios
 * @param {Invoice} invoice - Factura a validar
 * @returns {{valid: boolean, errors: string[]}} Objeto con el resultado de la validación
 */
function validateInvoice(invoice) {
  const errors = [];

  // Validar cliente
  if (!invoice.customer) {
    errors.push("El cliente es obligatorio");
  } else {
    if (!invoice.customer.identification || invoice.customer.identification.trim() === "") {
      errors.push("El documento del cliente es obligatorio");
    }
    if (!invoice.customer.name || invoice.customer.name.trim() === "") {
      errors.push("El nombre del cliente es obligatorio");
    }
  }

  // Validar items
  if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    errors.push("Debe haber al menos un producto o servicio");
  } else {
    invoice.items.forEach((item, index) => {
      if (!item.description || item.description.trim() === "") {
        errors.push(`El item ${index + 1} debe tener una descripción`);
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        errors.push(`El item ${index + 1} debe tener una cantidad válida mayor que 0`);
      }
      if (typeof item.price !== "number" || item.price < 0) {
        errors.push(`El item ${index + 1} debe tener un precio válido`);
      }
    });
  }

  // Validar pago
  if (!invoice.payment) {
    errors.push("Los detalles de pago son obligatorios");
  } else if (!invoice.payment.method || invoice.payment.method.trim() === "") {
    errors.push("El método de pago es obligatorio");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula el total de la factura (subtotal + impuestos)
 * @param {Invoice} invoice - Factura
 * @param {number} taxRate - Porcentaje de impuesto (ej: 19 para 19%)
 * @returns {number} Total de la factura
 */
function calculateTotal(invoice, taxRate = 19) {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  return subtotal * (1 + taxRate / 100);
}

module.exports = {
  validateInvoice,
  calculateTotal,
};