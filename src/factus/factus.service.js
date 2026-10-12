
const { get, post, FactusApiError } = require("./factus.client");

const { toFactusBill } = require("./factus.mapper");

const VALIDATE_PATH = "/v2/bills/validate";

// GET /v2/bills/:number/download-pdf devuelve el PDF de la factura en Base64.
// Docs: https://developers.factus.com.co/facturas/descargar-pdf/
const DOWNLOAD_PDF_PATH = (number) =>
  `/v2/bills/${encodeURIComponent(number)}/download-pdf`;

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

/**
 * Descarga el PDF de una factura ya validada en Factus.
 *
 * Llama a GET /v2/bills/:number/download-pdf, que devuelve el PDF codificado en
 * Base64 junto con el nombre del archivo. Nunca lanza por un error de Factus: en
 * ese caso devuelve `{ ok: false, reason }` para que el flujo degrade con
 * elegancia (el PDF puede llegar por correo como respaldo).
 *
 * @param {string|number} number - Número de la factura devuelto por createInvoice
 * @returns {Promise<{ok: true, base64: string, filename: string} | {ok: false, reason: string, status?: number}>}
 */
async function getInvoicePdf(number) {
  if (number == null || number === "") {
    return { ok: false, reason: "No hay número de factura para descargar el PDF." };
  }

  try {
    const response = await get(DOWNLOAD_PDF_PATH(number));
    const data = response?.data ?? response ?? {};

    const base64 = data.pdf_base_64_encoded ?? null;
    if (!base64) {
      console.error(
        `[factus.service] Respuesta de PDF sin pdf_base_64_encoded para factura ${number}`
      );
      return { ok: false, reason: "El servicio de facturación no devolvió el PDF." };
    }

    // Factus expone el nombre bajo distintas claves según el documento; usamos
    // las conocidas y caemos a un nombre derivado del número si no viene.
    const filename =
      data.file_name ?? data.name ?? data.number ?? `factura-${number}`;

    return {
      ok: true,
      base64,
      filename: String(filename).endsWith(".pdf")
        ? String(filename)
        : `${filename}.pdf`,
    };
  } catch (error) {
    if (error instanceof FactusApiError) {
      console.error(
        `[factus.service] Factus rechazó la descarga de PDF para ${number} ` +
          `(HTTP ${error.status}):`,
        JSON.stringify(error.body)
      );
      return {
        ok: false,
        reason: "No se pudo descargar el PDF de la factura en este momento.",
        status: error.status,
      };
    }

    console.error("[factus.service] Error inesperado descargando PDF:", error);
    return { ok: false, reason: "Ocurrió un error inesperado al obtener el PDF." };
  }
}

/**
 * Intenta extraer una URL pública de la factura desde la respuesta cruda de
 * validación de Factus, para usarla como enlace de descarga cuando el envío del
 * PDF adjunto por WhatsApp falla.
 *
 * Factus ha expuesto esta información bajo distintas claves según el documento
 * (p. ej. `public_url`, `qr`, `url`), por lo que la búsqueda es defensiva:
 * revisa `data` y `data.bill` y devuelve la primera URL http(s) que encuentre.
 *
 * @param {object} rawValidateResponse - el `raw` devuelto por createInvoice
 * @returns {string|null} una URL pública, o null si no se encontró ninguna
 */
function extractPublicUrl(rawValidateResponse) {
  const data = rawValidateResponse?.data ?? rawValidateResponse ?? {};
  const sources = [data, data.bill ?? {}];
  const keys = ["public_url", "qr", "url", "pdf_url", "link"];

  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === "string" && /^https?:\/\//i.test(value)) {
        return value;
      }
    }
  }
  return null;
}

module.exports = { createInvoice, getInvoicePdf, extractPublicUrl };
