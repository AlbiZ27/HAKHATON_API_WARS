const DEFAULTS = {
  numberingRangeId: Number(process.env.FACTUS_NUMBERING_RANGE_ID ?? 8),
  taxRate: process.env.FACTUS_DEFAULT_TAX_RATE ?? "19.00",
  unitMeasureCode: process.env.FACTUS_DEFAULT_UNIT_MEASURE_CODE ?? "94",
  paymentForm: process.env.FACTUS_DEFAULT_PAYMENT_FORM ?? "1",
  paymentMethodCode: process.env.FACTUS_DEFAULT_PAYMENT_METHOD_CODE ?? "10",
};

const FACTUS_CODES = {
  operationType: "10", // En Efectivo
  identificationDocumentCode: "13", // Cédula de ciudadanía
  legalOrganizationCode: "2", // 2 = PERSONA NATURAL
  tributeCode: "ZZ", // ZZ = No aplica
  municipalityCode: "11001", // Bogotá  default
  taxCode: "01", // 01 = IVA
  standardCode: "999", // Codigo del producto
};


function generateReferenceCode() {
  //Generar un código de referencia basado en el timestamp y un random string
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `FACT-${timestamp}-${random}`;
}

function mapItem(item) {
  // Mappear un item a la estructura que espera Factus
  return {
    //Toma los 10 primeros carateres y reemplaza los espacio por -
    code_reference: `PROD-${item.description.slice(0, 10).replace(/\s+/g, "-")}`,
    name: item.description,
    quantity: String(item.quantity),
    discount_rate: "0.00",
    price: Number(item.price).toFixed(2),
    unit_measure_code: DEFAULTS.unitMeasureCode,
    standard_code: FACTUS_CODES.standardCode,
    taxes: [
      {
        code: FACTUS_CODES.taxCode,
        rate: DEFAULTS.taxRate,
      },
    ],
  };
}

function computeTotal(items) {
  const taxMultiplier = 1 + Number(DEFAULTS.taxRate) / 100;
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.price),
    0
  );
  return (subtotal * taxMultiplier).toFixed(2);
}

function toFactusBill(invoice) {
  const referenceCode = generateReferenceCode();
  const total = computeTotal(invoice.items);

  return {
    reference_code: referenceCode,
    numbering_range_id: DEFAULTS.numberingRangeId,
    operation_type: FACTUS_CODES.operationType,
    payment_details: [
      {
        payment_form: DEFAULTS.paymentForm,
        payment_method_code: DEFAULTS.paymentMethodCode,
        amount: total,
      },
    ],
    customer: {
      identification_document_code: FACTUS_CODES.identificationDocumentCode,
      identification: invoice.customer.identification,
      names: invoice.customer.name,
      legal_organization_code: FACTUS_CODES.legalOrganizationCode,
      tribute_code: FACTUS_CODES.tributeCode,
      municipality_code: FACTUS_CODES.municipalityCode,
    },
    items: invoice.items.map(mapItem),
  };
}

module.exports = { toFactusBill, generateReferenceCode, computeTotal };
