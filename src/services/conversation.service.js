/**
 * Conversation Service
 * Maneja el estado de las conversaciones con los usuarios
 */

// Almacenamiento temporal de conversaciones (en producción usar una base de datos)
const conversations = new Map();

/**
 * Obtiene o crea el estado de conversación de un usuario
 * @param {string} phoneNumber - Número de teléfono del usuario (identificador único)
 * @returns {Object} Estado de conversación
 */
function getOrCreateConversation(phoneNumber) {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, {
      currentStep: "START",
      invoiceData: {
        customer: { identification: null, name: null },
        items: [],
        payment: { method: null }
      },
      messageHistory: [],
      createdAt: new Date()
    });
  }
  return conversations.get(phoneNumber);
}

/**
 * Actualiza el estado de conversación
 * @param {string} phoneNumber - Número de teléfono del usuario
 * @param {Object} updates - Valores a actualizar
 */
function updateConversation(phoneNumber, updates) {
  const conversation = getOrCreateConversation(phoneNumber);
  Object.assign(conversation, updates);
  conversations.set(phoneNumber, conversation);
}

/**
 * Avanza el estado de conversación al siguiente paso
 * @param {string} phoneNumber - Número de teléfono del usuario
 * @param {string} nextStep - Siguiente paso en la conversación
 * @param {Object} invoiceData - Datos de la factura actualizados (opcional)
 */
function advanceConversation(phoneNumber, nextStep, invoiceData = null) {
  const conversation = getOrCreateConversation(phoneNumber);
  conversation.currentStep = nextStep;
  if (invoiceData) {
    conversation.invoiceData = invoiceData;
  }
  conversations.set(phoneNumber, conversation);
}

/**
 * Guarda un mensaje en el historial
 * @param {string} phoneNumber - Número de teléfono del usuario
 * @param {string} message - Mensaje enviado
 * @param {string} sender - 'user' o 'bot'
 */
function saveMessage(phoneNumber, message, sender) {
  const conversation = getOrCreateConversation(phoneNumber);
  conversation.messageHistory.push({
    sender,
    message,
    timestamp: new Date()
  });
  // Mantener solo las últimas 100 mensa
  if (conversation.messageHistory.length > 100) {
    conversation.messageHistory = conversation.messageHistory.slice(-100);
  }
  conversations.set(phoneNumber, conversation);
}

/**
 * Obtiene el historial de mensajes de un usuario
 * @param {string} phoneNumber - Número de teléfono del usuario
 * @returns {Array} Historial de mensajes
 */
function getConversationHistory(phoneNumber) {
  const conversation = getOrCreateConversation(phoneNumber);
  return conversation.messageHistory || [];
}

/**
 * Elimina una conversación
 * @param {string} phoneNumber - Número de teléfono del usuario
 */
function deleteConversation(phoneNumber) {
  conversations.delete(phoneNumber);
}

/**
 * Limpia conversaciones antiguas (mayores a 24 horas)
 */
function cleanupOldConversations() {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [phoneNumber, conversation] of conversations.entries()) {
    if (conversation.createdAt < oneDayAgo) {
      conversations.delete(phoneNumber);
    }
  }
}

// Limpiar conversaciones antiguas cada hora
setInterval(cleanupOldConversations, 60 * 60 * 1000);

module.exports = {
  getOrCreateConversation,
  updateConversation,
  advanceConversation,
  saveMessage,
  getConversationHistory,
  deleteConversation,
  cleanupOldConversations
};