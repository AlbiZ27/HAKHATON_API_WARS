/**
 * WhatsApp Controller
 * Maneja los webhooks y la lógica de procesamiento de mensajes de WhatsApp
 */

const { processMessage, validateConfirmation } = require("../services/llm.service");
const { getOrCreateConversation, advanceConversation, saveMessage, deleteConversation } = require("../services/conversation.service");
const { createInvoice, getInvoicePdf } = require("../factus/factus.service");
const { storePdf } = require("../services/pdf-store.service");

// Base pública del servidor para construir enlaces de descarga del PDF. En
// local es http://localhost:PORT, pero para que el enlace sea accesible desde
// el teléfono del usuario debe apuntar a una URL pública (ngrok / Cloudflare
// Tunnel / deploy), configurada en PUBLIC_BASE_URL.
function getPublicBaseUrl() {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return base.replace(/\/+$/, "");
}

/**
 * Procesa un mensaje entrante de WhatsApp
 * @param {Object} payload - Payload del webhook de WhatsApp
 * @returns {Object} Respuesta para enviar al usuario
 */
async function handleIncomingMessage(payload) {
  try {
    // Extraer información del payload
    const entry = payload.entry?.[0];
    if (!entry) {
      console.log("[whatsapp.controller] No se encontraron entradas en el payload");
      return { status: "ignored" };
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      console.log("[whatsapp.controller] No se encontraron cambios en la entrada");
      return { status: "ignored" };
    }

    const value = changes.value;
    if (!value) {
      console.log("[whatsapp.controller] No se encontró valor en los cambios");
      return { status: "ignored" };
    }

    // Verificar si hay mensajes
    const messages = value.messages;
    if (!messages || messages.length === 0) {
      console.log("[whatsapp.controller] No se encontraron mensajes en la entrada");
      return { status: "ignored" };
    }

    const message = messages[0];
    if (message.type !== "text") {
      console.log("[whatsapp.controller] Solo se procesan mensajes de texto");
      return { status: "ignored", reason: "non-text-message" };
    }

    const phoneNumber = message.from; // Número del usuario que envió el mensaje
    const text = message.text.body;

    // Guardar mensaje del usuario en el historial
    saveMessage(phoneNumber, text, "user");

    // Obtener estado actual de la conversación
    const conversation = getOrCreateConversation(phoneNumber);

    // Procesar mensaje con el LLM
    const result = await processMessage(text, {
      currentStep: conversation.currentStep,
      invoiceData: conversation.invoiceData
    });

    // Si se canceló la conversación
    if (result.cancelled) {
      deleteConversation(phoneNumber);
    }
    // Si hay una actualización de la factura
    else if (result.updatedInvoice) {
      advanceConversation(phoneNumber, result.nextStep, result.updatedInvoice);
    }
    // Si se necesita confirmación
    else if (result.requiresConfirmation) {
      advanceConversation(phoneNumber, result.nextStep, result.invoice);
    }
    // Si se avanzó de paso en la conversación
    else if (result.nextStep && result.nextStep !== conversation.currentStep) {
      advanceConversation(phoneNumber, result.nextStep, result.updatedInvoice || conversation.invoiceData);
    }

    // Guardar respuesta del bot en el historial
    saveMessage(phoneNumber, result.response, "bot");

    return {
      status: "success",
      response: result.response,
      phoneNumber
    };
  } catch (error) {
    console.error("[whatsapp.controller] Error processing message:", error);
    return {
      status: "error",
      error: error.message
    };
  }
}

/**
 * Procesa una confirmación de factura
 * @param {Object} payload - Payload del webhook de WhatsApp
 * @returns {Object} Respuesta para enviar al usuario
 */
async function handleConfirmation(payload) {
  try {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return { status: "ignored" };
    }

    const message = messages[0];
    if (message.type !== "text") {
      return { status: "ignored" };
    }

    const phoneNumber = message.from;
    const text = message.text.body;

    // Validar confirmación
    const confirmation = validateConfirmation(text);

    if (confirmation.confirmed) {
      // Obtener la factura pendiente
      const conversation = getOrCreateConversation(phoneNumber);
      const invoice = conversation.invoiceData;

      // Enviar a Factus
      const factusResponse = await createInvoice(invoice);

      if (factusResponse.ok) {
        // Entrega del PDF por WhatsApp mediante un ENLACE de descarga.
        //
        // No adjuntamos el archivo: whatsapp-web.js falla al enviar media a los
        // chats con direccionamiento "@lid" (número enmascarado), que es el caso
        // habitual. El envío de texto sí funciona, así que descargamos el PDF de
        // Factus, lo publicamos en el store HTTP y mandamos un único mensaje con
        // el enlace. Esto funciona para todos los chats ("@lid" y "@c.us").
        //
        // El correo del cliente se sigue capturando y enviando a Factus (dato
        // del adquiriente). El envío del PDF por correo lo hace Factus en
        // producción; queda disponible como escalabilidad futura.
        let downloadUrl = null;

        const pdf = await getInvoicePdf(factusResponse.invoiceNumber);
        if (pdf.ok) {
          const token = storePdf({ base64: pdf.base64, filename: pdf.filename });
          downloadUrl = `${getPublicBaseUrl()}/invoices/${token}.pdf`;
        } else {
          console.error(
            `[whatsapp.controller] No se pudo descargar el PDF de la factura ` +
              `${factusResponse.invoiceNumber}: ${pdf.reason}`
          );
        }

        // Línea de entrega: enlace de descarga, o un mensaje de reintento si no
        // se pudo obtener el PDF.
        const deliveryLine = downloadUrl
          ? `Puedes descargar tu factura aquí:\n${downloadUrl}`
          : `No pude obtener el PDF en este momento. Escribe *factura* para reintentar.`;

        const responseMessage = `✅ *Factura generada correctamente!*\n\n` +
          `Número de factura: ${factusResponse.invoiceNumber}\n` +
          `Código de referencia: ${factusResponse.referenceCode}\n` +
          `Total: $${factusResponse.total}\n\n` +
          deliveryLine;

        // Limpiar conversación
        deleteConversation(phoneNumber);

        return {
          status: "success",
          response: responseMessage,
          factusResponse,
          phoneNumber
        };
      } else {
        const responseMessage = `❌ *No se pudo generar la factura*\n\n` +
          `Motivo: ${factusResponse.reason}\n` +
          `Código de error: ${factusResponse.status}`;

        // Limpiar conversación
        deleteConversation(phoneNumber);

        return {
          status: "error",
          response: responseMessage,
          factusResponse,
          phoneNumber
        };
      }
    } else if (confirmation.cancelled) {
      deleteConversation(phoneNumber);
      return {
        status: "success",
        response: "¡Entendido! He cancelado la generación de la factura.",
        phoneNumber
      };
    } else {
      return {
        status: "error",
        response: "Por favor responde con 'Sí' para confirmar o 'No' para cancelar.",
        phoneNumber
      };
    }
  } catch (error) {
    console.error("[whatsapp.controller] Error processing confirmation:", error);
    return {
      status: "error",
      error: error.message
    };
  }
}

/**
 * Maneja la recepción de mensajes de WhatsApp
 * @param {Object} payload - Payload del webhook
 * @returns {Object} Resultado del procesamiento
 */
async function receiveMessage(payload) {
  try {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return { status: "ignored" };
    }

    const message = messages[0];
    const phoneNumber = message.from;

    // Verificar si hay una conversación pendiente de confirmación
    const conversation = getOrCreateConversation(phoneNumber);
    if (conversation.currentStep === "WAITING_FOR_CONFIRMATION") {
      return await handleConfirmation(payload);
    }

    // Procesar mensaje normal
    return await handleIncomingMessage(payload);
  } catch (error) {
    console.error("[whatsapp.controller] Error receiving message:", error);
    return {
      status: "error",
      error: error.message
    };
  }
}

module.exports = {
  handleIncomingMessage,
  handleConfirmation,
  receiveMessage
};