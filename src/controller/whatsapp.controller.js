/**
 * WhatsApp Controller
 * Maneja los webhooks y la lógica de procesamiento de mensajes de WhatsApp
 */

const { processMessage, validateConfirmation } = require("../services/llm.service");
const { getOrCreateConversation, advanceConversation, saveMessage, deleteConversation } = require("../services/conversation.service");
const { createInvoice } = require("../services/factus.service");

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
        const responseMessage = `✅ *Factura generada correctamente!*\n\n` +
          `Número de factura: ${factusResponse.invoiceNumber}\n` +
          `Código de referencia: ${factusResponse.referenceCode}\n` +
          `Total: $${factusResponse.total}\n\n` +
          `Se ha enviado el PDF a tu correo registrado en Factus.`;

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