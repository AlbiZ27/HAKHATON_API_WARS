/**
 * LLM Service
 * Maneja la interacción con el modelo de lenguaje para interpretar mensajes de WhatsApp
 */

const { validateInvoice, calculateTotal } = require("../models/invoice.model");
const { extractInvoiceWithGemini, isGeminiConfigured } = require("./gemini.service");

/**
 * Patrones de texto para detectar diferentes intenciones
 */
const INTENT_PATTERNS = {
  HELP: /ayuda|help|qué puedes hacer|cómo funciona|qué se puede hacer/i,
  START_INVOICE: /\b(factura|facturar)\b|emitir factura|generar factura|crear factura/i,
  CANCEL: /^cancelar|detener|terminar|abortar/i,
  CONFIRM: /^sí|si|confirmar|aceptar|correcto|dale|ok|okay/i,
  REJECT: /^no|cancelar|negar|rechazar/i,
  GREETING: /\b(hola|buenas|buenos días|buenas tardes|buenas noches|qué tal|hey|holi|saludos)\b/i,
};

/**
 * Intentos de validación para diferentes campos
 */
const VALIDATION_INTENTS = {
  CUSTOMER_ID: /(?:CC|cedula|cedula de ciudadania|nit|tax id)[:\s]*([\d\.]+)/i,
  CUSTOMER_NAME: /(?:a|cliente|nombre de|para)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  PRODUCT: /(\d+)\s*(?:camisetas?|camisas?|product|artículo|items?|cosas?)\s*(?:de|para|:)?\s*(.+?)(?=\s*(?:a|costo|precio|cada|unitario|$))/i,
  QUANTITY: /(\d+)\s*(?:unidades?|piezas?|cantidad|artículos?)/i,
  PRICE: /(\d+)\s*(?:pesos|cop|dolares?|\$)?\s*(?:a|costo|precio|cada|unitario)/i,
  PAYMENT: /(?:efectivo|tarjeta|transferencia|nequi|pse|pago|pagó|pago en)/i,
};

/**
 * Intentos de validación para diferentes campos (versión más flexible)
 */
function extractCustomerIdentification(text) {
  // Buscar patrones como "CC 1234567890", "cedula 1234567890", "1234567890"
  const patterns = [
    /(?:CC|cedula|cedula de ciudadania)[:\s]*([\d\.\-]+)/i,
    /^([\d\.\-]+)\s*(?:es|es su|es el|es de|documento)$/i,
    /^(\d{7,15})$/ // Cualquier número de 7 a 15 dígitos (grupo capturado)
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    // Guardar contra patrones sin grupo de captura: solo usar match[1].
    if (match && match[1]) {
      // Limpiar el número (quitar puntos y guiones)
      const clean = match[1].replace(/[.\-]/g, "");
      if (clean.length >= 7 && clean.length <= 15) {
        return clean;
      }
    }
  }
  return null;
}

/**
 * Extrae un correo electrónico del texto, si hay uno válido.
 * Acepta frases como "mi correo es ana@mail.com", "envíalo a x@y.co" o el
 * correo suelto.
 * @param {string} text
 * @returns {string|null} el correo en minúsculas, o null si no hay uno válido
 */
function extractEmail(text) {
  const match = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function extractCustomerName(text) {
  // Buscar patrones como "a Juan Pérez", "nombre: Juan Pérez", "Juan Pérez"
  const patterns = [
    // Nombre suelto al inicio del mensaje (caso conversacional: el usuario
    // responde solo con el nombre). Debe ir primero para no ser canibalizado
    // por los prefijos de abajo.
    /^([A-ZÀ-Ÿ][a-zÀ-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zÀ-ÿ]+)+)\s*$/,
    // Prefijos como palabras completas (\b + separador explícito) para no
    // comerse letras internas de un nombre (ej. la "a" de "Carla").
    /\b(?:cliente|nombre de|factura a|facturar a|para)[:\s]+([A-ZÀ-Ÿ][a-zÀ-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zÀ-ÿ]+)*)/i,
    /^([A-ZÀ-Ÿ][a-zÀ-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zÀ-ÿ]+)*)\s*,/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      // Asegurarse de que el nombre no sea una palabra reservada
      if (!/^(factura|facturar|facturo|emito|emitir)$/i.test(name)) {
        return name;
      }
    }
  }
  return null;
}

function extractProducts(text) {
  // Buscar patrones como "2 camisetas negras a 50.000", "5 pantalones azules a 120000", etc.
  // Buscar primero patrones que incluyen precio
  const productPricePattern = /(\d+)\s*([a-zA-ZÀ-ÿ\s]+?)\s*a\s*\$?\s*([\d\.]+)/gi;
  const productOnlyPattern = /(\d+)\s*([a-zA-ZÀ-ÿ\s]+?)(?=\s*(?:,|$))/gi;
  
  const products = [];
  
  // Primero intentar con precio
  const priceMatches = text.matchAll(productPricePattern);
  for (const match of priceMatches) {
    const product = match[2].trim();
    // Limpiar el nombre del producto (quitar "de" si está al principio)
    const cleanProduct = product.replace(/^de\s+/i, "").trim();
    products.push({
      quantity: parseInt(match[1]),
      description: cleanProduct
    });
  }
  
  // Si no se encontraron con precio, intentar solo con producto
  if (products.length === 0) {
    const onlyMatches = text.matchAll(productOnlyPattern);
    for (const match of onlyMatches) {
      const product = match[2].trim();
      const cleanProduct = product.replace(/^de\s+/i, "").trim();
      products.push({
        quantity: parseInt(match[1]),
        description: cleanProduct
      });
    }
  }
  
  return products.length > 0 ? products : null;
}

function extractQuantity(text) {
  // Buscar patrones como "2 camisetas", "dos camisetas", etc.
  const patterns = [
    /(\d+)\s*(?:camisetas?|camisas?|unidades?|piezas?|artículos?|cosas?)/i,
    /^(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:camisetas?|camisas?|unidades?|piezas?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numberMap = {
        "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
        "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10
      };
      const word = match[1].toLowerCase();
      return numberMap[word] || parseInt(match[1]);
    }
  }
  return null;
}

function extractPrice(text) {
  // Buscar patrones como "50.000", "50000", "50 mil", etc.
  const patterns = [
    /(\d+\.?\d*)\s*(?:pesos|cop|dolares?|\$)?\s*(?:a|costo|precio|cada|unitario)/i,
    /(\d+\.?\d*)\s*(?:a|costo|precio|cada|unitario)\s*(?:pesos|cop|dolares?|\$)?/i,
    /(\d+)\s*mil\s*(?:pesos|cop|dolares?|\$)?/i,
    // Número suelto (ej: "40000", "40.000", "$50.000"): útil en el paso
    // conversacional donde ya se preguntó explícitamente el precio.
    /^\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:pesos|cop)?$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1].replace(".", "");
      if (numStr.includes("mil")) {
        const num = parseFloat(numStr.replace("mil", "").trim());
        return num * 1000;
      }
      return parseFloat(numStr);
    }
  }
  return null;
}

function extractPaymentMethod(text) {
  // Buscar patrones como "en efectivo", "pago en efectivo", etc.
  const patterns = [
    /(?:en|pago en|pago con|con)\s*(efectivo|tarjeta|transferencia|nequi|pse|daviplata|punto)/i,
    /^(efectivo|tarjeta|transferencia|nequi|pse|daviplata|punto)$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Determina la intención del mensaje
 * @param {string} text - Texto del mensaje
 * @returns {string|null} Intención detectada (START_INVOICE, HELP, CANCEL, CONFIRM, REJECT, etc.)
 */
function detectIntent(text) {
  if (INTENT_PATTERNS.HELP.test(text)) return "HELP";
  if (INTENT_PATTERNS.START_INVOICE.test(text)) return "START_INVOICE";
  if (INTENT_PATTERNS.CANCEL.test(text)) return "CANCEL";
  if (INTENT_PATTERNS.CONFIRM.test(text)) return "CONFIRM";
  if (INTENT_PATTERNS.REJECT.test(text)) return "REJECT";
  // GREETING va de último (antes de UNKNOWN) para no pisar intenciones más
  // específicas como START_INVOICE en "hola, quiero una factura".
  if (INTENT_PATTERNS.GREETING.test(text)) return "GREETING";
  return "UNKNOWN";
}

/**
 * Intenta extraer toda la información de una factura de un solo mensaje
 * @param {string} text - Texto del mensaje
 * @returns {Object} Objeto con la información extraída
 */
function extractInvoiceFromSingleMessage(text) {
  const customerIdentification = extractCustomerIdentification(text);
  const customerName = extractCustomerName(text);
  const products = extractProducts(text);
  const price = extractPrice(text);
  const paymentMethod = extractPaymentMethod(text);

  // Si tenemos productos con cantidades y precios, construimos items
  let items = null;
  if (products && price) {
    items = products.map(p => ({
      description: p.description,
      quantity: p.quantity,
      price: price
    }));
  } else if (products) {
    // Si no tenemos precio, lo marcaremos como null para pedirlo
    items = products.map(p => ({
      description: p.description,
      quantity: p.quantity,
      price: null
    }));
  }

  const invoice = {
    customer: {
      identification: customerIdentification,
      name: customerName
    },
    items,
    payment: {
      method: paymentMethod
    }
  };

  return invoice;
}

/**
 * Valida que un objeto de factura tenga todos los campos obligatorios
 * @param {Object} invoice - Objeto con la información extraída
 * @returns {boolean} True si todos los campos obligatorios están presentes
 */
function isInvoiceComplete(invoice) {
  return (
    invoice.customer?.identification?.trim() &&
    invoice.customer?.name?.trim() &&
    invoice.items?.length > 0 &&
    invoice.items.every(item => item.description && item.quantity && item.price) &&
    invoice.payment?.method?.trim()
  );
}

/**
 * Procesa un mensaje usando el LLM (simulación o integración real)
 * @param {string} text - Texto del mensaje
 * @param {Object} conversationState - Estado actual de la conversación
 * @returns {Object} Objeto con el resultado del procesamiento
 */
async function processMessage(text, conversationState = { currentStep: "START", invoiceData: {} }) {
  const intent = detectIntent(text);

  // Saludo: presentarse y dar contexto de quién es el bot y qué puede hacer.
  // Solo cuando no estamos en medio de una conversación activa, para no cortar
  // un flujo en curso si el usuario saluda a mitad de camino.
  if (
    intent === "GREETING" &&
    (!conversationState.currentStep || conversationState.currentStep === "START")
  ) {
    return {
      response:
        "¡Hola! 👋 Soy el asistente de facturación electrónica de *Factus*.\n\n" +
        "Puedo ayudarte a generar facturas electrónicas válidas ante la DIAN directamente por WhatsApp.\n\n" +
        "Para empezar, escribí *factura* y te guío paso a paso, o mandame todos los datos juntos, por ejemplo:\n" +
        '"Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo."',
      nextStep: "START"
    };
  }

  // Si el usuario pide ayuda
  if (intent === "HELP") {
    return {
      response: "Puedo ayudarte a generar una factura. Simplemente envíame los datos, por ejemplo:\n\n" +
        '"Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo."\n\n' +
        "O simplemente empieza con 'factura' y te iré preguntando los datos.",
      nextStep: conversationState.currentStep || "START"
    };
  }

  // Si el usuario cancela
  if (intent === "CANCEL") {
    return {
      response: "¡Entendido! He cancelado el proceso. Si necesitas generar una factura en el futuro, solo dime 'factura'.",
      nextStep: "START",
      cancelled: true
    };
  }

  // Si estamos en medio de una conversación
  if (conversationState.currentStep && conversationState.currentStep !== "START") {
    return processConversationalStep(text, conversationState);
  }

  // Si el usuario inicia una factura
  if (intent === "START_INVOICE") {
    return {
      response: "¡Claro! Vamos a generar una factura. ¿Cuál es el número de documento del cliente?",
      nextStep: "WAITING_FOR_CUSTOMER_ID",
      invoiceData: {
        customer: { identification: null, name: null },
        items: [],
        payment: { method: null }
      }
    };
  }

  // Para una factura completa capturada de un solo mensaje: si falta el correo,
  // pedirlo antes de confirmar; si ya viene, ir directo al resumen.
  const toCompletionOrEmail = (built) => {
    if (!built.customer?.email) {
      return {
        response:
          buildInvoiceSummary(built, calculateTotal(built)) +
          "\n\nAntes de confirmar, ¿a qué correo electrónico enviamos la factura?",
        nextStep: "WAITING_FOR_EMAIL",
        updatedInvoice: built
      };
    }
    return {
      response: buildInvoiceSummary(built, calculateTotal(built)),
      nextStep: "WAITING_FOR_CONFIRMATION",
      invoice: built,
      requiresConfirmation: true
    };
  };

  // Primera línea: intentar extraer todo con el motor de reglas (regex). Es
  // instantáneo y resuelve la mayoría de los mensajes bien formados.
  let invoice = extractInvoiceFromSingleMessage(text);
  if (invoice.customer) invoice.customer.email = extractEmail(text) ?? null;

  // Si la información está completa y válida, pedir correo (si falta) o confirmar.
  if (isInvoiceComplete(invoice)) {
    return toCompletionOrEmail(invoice);
  }

  // Fallback inteligente: si el regex no logró una factura completa, pedirle a
  // Gemini que extraiga los datos del lenguaje natural. Gemini nunca lanza: si
  // falla o excede el timeout devuelve null, y seguimos con el flujo normal.
  if (isGeminiConfigured()) {
    const geminiInvoice = await extractInvoiceWithGemini(text);
    if (geminiInvoice) {
      // Conservar un correo detectado en el texto si Gemini no lo trajo.
      if (!geminiInvoice.customer?.email) {
        const emailInText = extractEmail(text);
        if (emailInText) geminiInvoice.customer.email = emailInText;
      }
      if (isInvoiceComplete(geminiInvoice)) {
        return toCompletionOrEmail(geminiInvoice);
      }
      // Parcial: usar lo de Gemini como base para pedir lo que falta.
      invoice = geminiInvoice;
    }
  }

  // Si (con regex o Gemini) sigue incompleta, mostrar qué falta.
  const validation = validateInvoice(invoice);
  if (!validation.valid) {
    return {
      response: buildValidationResponse(validation.errors, invoice),
      nextStep: conversationState.currentStep || "START",
      invoice,
      validationErrors: validation.errors
    };
  }

  // Si no se entiende el mensaje
  return {
    response: "Lo siento, no entendí bien tu mensaje. Puedo ayudarte a generar una factura. ¿Quieres intentarlo?",
    nextStep: "START"
  };
}

/**
 * Procesa un paso de la conversación
 * @param {string} text - Texto del mensaje
 * @param {Object} conversationState - Estado actual de la conversación
 * @returns {Object} Objeto con el resultado del procesamiento
 */
function processConversationalStep(text, conversationState) {
  const { currentStep, invoiceData } = conversationState;

  switch (currentStep) {
    case "WAITING_FOR_CUSTOMER_ID":
      const customerId = extractCustomerIdentification(text);
      if (customerId) {
        return {
          response: "¿Cuál es el nombre completo del cliente?",
          nextStep: "WAITING_FOR_CUSTOMER_NAME",
          updatedInvoice: { ...invoiceData, customer: { ...invoiceData.customer, identification: customerId } }
        };
      }
      return {
        response: "Por favor, envíame el número de documento (CC, NIT, etc.)",
        nextStep: currentStep,
        invoiceData
      };

    case "WAITING_FOR_CUSTOMER_NAME":
      const name = extractCustomerName(text);
      if (name) {
        return {
          response: "¿Qué productos o servicios vendiste?",
          nextStep: "WAITING_FOR_PRODUCTS",
          updatedInvoice: { ...invoiceData, customer: { ...invoiceData.customer, name } }
        };
      }
      return {
        response: "Por favor, envíame el nombre completo del cliente",
        nextStep: currentStep,
        invoiceData
      };

    case "WAITING_FOR_PRODUCTS":
      const products = extractProducts(text);
      if (products) {
        return {
          response: "¿Cuál es el precio por unidad?",
          nextStep: "WAITING_FOR_PRICE",
          updatedInvoice: { ...invoiceData, items: products }
        };
      }
      return {
        response: "Por favor, envíame los productos en formato: '2 camisetas negras'",
        nextStep: currentStep,
        invoiceData
      };

    case "WAITING_FOR_PRICE":
      const price = extractPrice(text);
      if (price) {
        // Actualizar precios de los items
        const itemsWithPrice = (invoiceData.items || []).map(item => ({
          ...item,
          price
        }));
        return {
          response: "¿En qué forma de pago realizó la compra? (ej: efectivo, tarjeta, nequi)",
          nextStep: "WAITING_FOR_PAYMENT",
          updatedInvoice: { ...invoiceData, items: itemsWithPrice }
        };
      }
      return {
        response: "Por favor, envíame el precio en números (ej: 50000 o 50.000)",
        nextStep: currentStep,
        invoiceData
      };

    case "WAITING_FOR_PAYMENT":
      const paymentMethod = extractPaymentMethod(text);
      if (paymentMethod) {
        // Tras el pago, pedir el correo al que se enviará la factura antes de
        // confirmar.
        return {
          response: "¿A qué correo electrónico enviamos la factura?",
          nextStep: "WAITING_FOR_EMAIL",
          updatedInvoice: { ...invoiceData, payment: { method: paymentMethod } }
        };
      }
      return {
        response: "Por favor, envíame la forma de pago (efectivo, tarjeta, nequi, etc.)",
        nextStep: currentStep,
        invoiceData
      };

    case "WAITING_FOR_EMAIL":
      const email = extractEmail(text);
      if (email) {
        const invoice = {
          ...invoiceData,
          customer: { ...invoiceData.customer, email }
        };
        const validation = validateInvoice(invoice);
        if (validation.valid) {
          const total = calculateTotal(invoice);
          return {
            response: buildInvoiceSummary(invoice, total),
            nextStep: "WAITING_FOR_CONFIRMATION",
            invoice,
            requiresConfirmation: true
          };
        }
        return {
          response: "Por favor, revísalo y vuelve a enviar la información completa.",
          nextStep: "START",
          invoice: null
        };
      }
      return {
        response: "Por favor, envíame un correo electrónico válido (ej: cliente@correo.com)",
        nextStep: currentStep,
        invoiceData
      };

    default:
      return {
        response: "Lo siento, no entendí. ¿Qué información necesitas提供?",
        nextStep: "START"
      };
  }
}

/**
 * Construye un resumen de la factura para mostrar al usuario
 * @param {Object} invoice - Datos de la factura
 * @param {number} total - Total de la factura
 * @returns {string} Mensaje de resumen
 */
function buildInvoiceSummary(invoice, total) {
  const itemsText = invoice.items.map((item, index) => 
    `${index + 1}. ${item.description} - Cantidad: ${item.quantity} - Precio: $${item.price.toLocaleString()}`
  ).join("\n");

  return `*Resumen de la factura:*\n\n` +
    `Cliente: ${invoice.customer.name}\n` +
    `Documento: ${invoice.customer.identification}\n` +
    (invoice.customer?.email ? `Correo: ${invoice.customer.email}\n` : "") +
    `\nProductos:\n${itemsText}\n\n` +
    `Método de pago: ${invoice.payment.method}\n` +
    `Total estimado: $${Math.round(total).toLocaleString()}\n\n` +
    `¿Deseas generar esta factura? (Sí / No)`;
}

/**
 * Construye una respuesta de validación
 * @param {string[]} errors - Errores de validación
 * @param {Object} invoice - Datos de la factura
 * @returns {string} Mensaje de respuesta
 */
function buildValidationResponse(errors, invoice) {
  const errorsText = errors.map(e => `• ${e}`).join("\n");
  
  if (errors.length === 1 && errors[0] === "Debe haber al menos un producto o servicio") {
    return "Por favor, envíame los productos que vendiste. Ejemplo: '2 camisetas negras'";
  }

  return `Hay algunos datos incompletos:\n\n${errorsText}\n\n` +
    "Por favor, envíame la información completa para generar la factura.";
}

/**
 * Valida que una respuesta de confirmación sea válida
 * @param {string} text - Texto de la respuesta
 * @returns {Object} Objeto con la respuesta de confirmación
 */
function validateConfirmation(text) {
  if (/^(sí|si|confirmar|aceptar|correcto|dale|ok|okay)$/i.test(text)) {
    return { confirmed: true };
  }
  if (/^(no|cancelar|negar|rechazar)$/i.test(text)) {
    return { confirmed: false, cancelled: true };
  }
  return { confirmed: null, invalid: true };
}

module.exports = {
  processMessage,
  validateConfirmation,
  detectIntent,
  extractInvoiceFromSingleMessage,
  buildInvoiceSummary,
  buildValidationResponse,
  INTENT_PATTERNS,
  VALIDATION_INTENTS
};