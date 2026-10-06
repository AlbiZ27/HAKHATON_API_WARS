
const { post, FactusApiError } = require("./factus.client");

const { toFactusBill } = require("./factus.mapper");

const VALIDATE_PATH = "/v2/bills/validate";

function friendlyReason(error) {
  if (error.status === 422) {
    return "Algunos datos de la factura no son válidos. Revisa el documento del cliente y los productos.";
  }
  if (error.status === 401) {
    return "Hubo un problema de autenticación con el servicio de facturación.";
  }
  if (error.status === 409) {
    return "Ya existe una factura con esa referencia.";
  }
  return "No se pudo generar la factura en este momento. Intenta nuevamente más tarde.";
}


async function createInvoice(invoice) {
  const payload = toFactusBill(invoice);

  try {
    const response = await post(VALIDATE_PATH, payload);
    const data = response?.data ?? {};

    return {
      ok: true,
      invoiceNumber: data.number ?? null,
      referenceCode: data.reference_code ?? payload.reference_code,
      isValidated: data.is_validated ?? false,
      total: data.payment_details?.[0]?.amount ?? null,
      raw: response,
    };
  } catch (error) {
    if (error instanceof FactusApiError) {
      console.error(
        `[factus.service] Factus rejected invoice ${payload.reference_code} ` +
          `(HTTP ${error.status}):`,
        JSON.stringify(error.body)
      );

      return {
        ok: false,
        reason: friendlyReason(error),
        status: error.status,
        details: error.body,
      };
    }

    console.error("[factus.service] Unexpected error creating invoice:", error);
    throw error;
  }
}

module.exports = { createInvoice };
