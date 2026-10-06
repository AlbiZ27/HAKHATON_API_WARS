# Factus WhatsApp Bot

## 1. Descripción del proyecto

**Factus WhatsApp Bot** es una solución de facturación electrónica orientada a pequeños negocios que no cuentan con un sistema contable o de facturación especializado.

La idea es permitir que el negocio genere una factura electrónica desde **WhatsApp**, enviando los datos de la venta mediante una conversación sencilla. Nuestro backend interpreta y valida la información, construye la estructura requerida por **Factus** y utiliza su API para generar la factura.

El objetivo principal es reducir la barrera tecnológica: el usuario no necesita aprender a utilizar un ERP, una aplicación de facturación compleja ni conocer una API. Solo necesita utilizar WhatsApp, una herramienta que ya conoce.

---

## 2. Problema

Muchos pequeños negocios registran sus ventas de manera manual o utilizan herramientas sencillas como cuadernos, hojas de cálculo o mensajería.

Cuando necesitan facturación electrónica, aparecen varias dificultades:

- Configurar un sistema de facturación.
- Entender conceptos técnicos y tributarios.
- Registrar manualmente la información de cada factura.
- Cometer errores al introducir datos del cliente o de los productos.
- Aprender a utilizar un software nuevo.

El proyecto busca simplificar este proceso mediante una interfaz conversacional.

---

## 3. Propuesta de solución

El usuario envía por WhatsApp los datos necesarios para una factura.

Ejemplo:

> Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo.

El sistema:

1. Recibe el mensaje mediante WhatsApp Business Platform.
2. Interpreta y extrae los datos necesarios.
3. Valida que la información esté completa y sea coherente.
4. Presenta al usuario un resumen de la factura.
5. Solicita confirmación.
6. Convierte la información al formato requerido por Factus.
7. Se autentica mediante OAuth2 y consume la API de Factus.
8. Recibe el resultado de la operación.
9. Informa al usuario si la factura fue generada correctamente.
10. En una etapa posterior, entrega el PDF de la factura por WhatsApp.

---

## 4. Objetivo general

Desarrollar un bot de WhatsApp capaz de recibir los datos de una venta, validarlos y utilizar la API de Factus para generar una factura electrónica de forma sencilla y accesible para pequeños negocios.

---

## 5. Objetivos específicos

- Integrar WhatsApp Business Platform mediante webhooks.
- Crear un backend que gestione la comunicación entre WhatsApp y Factus.
- Implementar autenticación OAuth2 con Factus.
- Definir un modelo interno de factura independiente de la estructura específica de Factus.
- Validar los datos antes de enviarlos a Factus.
- Implementar un flujo conversacional de confirmación.
- Generar facturas utilizando el endpoint de validación de Factus.
- Manejar errores de manera comprensible para el usuario.
- Permitir posteriormente la entrega del PDF de la factura por WhatsApp.

---

## 6. Arquitectura general

```text
                           USUARIO
                              |
                              | Mensaje
                              v
                 +---------------------------+
                 | WhatsApp Business         |
                 | Platform / Cloud API      |
                 +-------------+-------------+
                               |
                               | Webhook HTTPS
                               v
        +------------------------------------------------+
        |               NUESTRO BACKEND                  |
        |                                                |
        |  Node.js + Express + TypeScript                |
        |                                                |
        |  +-------------------+                         |
        |  | Webhook           |                         |
        |  +---------+---------+                         |
        |            |                                   |
        |            v                                   |
        |  +-------------------+                         |
        |  | Lógica del bot    |                         |
        |  | y conversación    |                         |
        |  +---------+---------+                         |
        |            |                                   |
        |            v                                   |
        |  +-------------------+                         |
        |  | Validación        |                         |
        |  +---------+---------+                         |
        |            |                                   |
        |            v                                   |
        |  +-------------------+                         |
        |  | Factus Service    |                         |
        |  +---------+---------+                         |
        +------------|-----------------------------------+
                     |
                     | HTTPS + JSON + OAuth2
                     v
             +-------------------+
             |    FACTUS API     |
             +---------+---------+
                       |
                       | Resultado
                       v
             +-------------------+
             | Factura validada  |
             | PDF / estado      |
             +---------+---------+
                       |
                       v
                 WhatsApp
                       |
                       v
                    Usuario
```

---

## 7. Componentes principales

### 7.1. WhatsApp Business Platform

Es la capa de comunicación con el usuario.

Funciones principales para el MVP:

- Recibir mensajes.
- Enviar mensajes de respuesta.
- Recibir eventos mediante webhooks.
- Posteriormente, enviar archivos como el PDF de la factura.

> El proyecto debe utilizar la plataforma oficial de WhatsApp Business/Cloud API y no automatizaciones de WhatsApp Web con Selenium, Puppeteer o librerías no oficiales.

---

### 7.2. Backend

El backend será el centro de la aplicación.

Tecnologías propuestas:

- Node.js
- TypeScript
- Express

Responsabilidades:

- Recibir el webhook de WhatsApp.
- Identificar al usuario.
- Gestionar el estado de la conversación.
- Validar los datos de la factura.
- Convertir el modelo interno al formato de Factus.
- Gestionar autenticación y tokens de Factus.
- Consumir la API de Factus.
- Procesar respuestas y errores.
- Enviar la respuesta a WhatsApp.

---

### 7.3. Factus API

Factus será el servicio encargado de la facturación electrónica.

Para el MVP se utilizarán principalmente:

- Autenticación OAuth2.
- Creación/validación de facturas.
- Consulta de información necesaria para la operación.
- Consulta de rangos de numeración cuando sea necesario.
- Obtención del PDF en etapas posteriores.

El endpoint de creación y validación de facturas de Factus se documenta como `POST /v2/bills/validate`.

Documentación oficial:

- https://developers.factus.com.co/
- https://developers.factus.com.co/facturas/ejemplos/estandar-orden-servicio/

---

### 7.4. Base de datos

Para el MVP se propone PostgreSQL.

Información que podría almacenarse:

- Usuarios.
- Empresas.
- Configuración de Factus.
- Conversaciones o sesiones.
- Facturas generadas.
- Estados y errores.

No se debe almacenar información sensible innecesaria.

---

## 8. Modelo interno de factura

El bot no debería depender directamente de la estructura de Factus.

Primero se construye un modelo propio:

```typescript
interface Invoice {
    customer: {
        identification: string;
        name: string;
    };

    items: {
        description: string;
        quantity: number;
        price: number;
    }[];

    payment: {
        method: string;
    };
}
```

Después se utiliza un adaptador para transformar este modelo al JSON requerido por Factus.

```text
Mensaje WhatsApp
       |
       v
Modelo interno Invoice
       |
       v
Factus Mapper
       |
       v
JSON Factus
       |
       v
Factus API
```

Esta separación permite modificar la lógica de la aplicación sin acoplarla completamente a la API externa.

---

## 9. Flujo principal del bot

### Flujo conversacional asistido

```text
Usuario
  |
  | "Quiero generar una factura"
  v
Bot
  |
  | Solicita datos faltantes
  v
Cliente + documento + producto + cantidad + precio + pago
  |
  v
Validación
  |
  v
Resumen de factura
  |
  | "¿Deseas generar la factura?"
  v
Usuario confirma
  |
  v
Factus API
  |
  v
Resultado
  |
  v
WhatsApp
```

---

## 10. Ejemplo de conversación

**Usuario:**

> Quiero hacer una factura.

**Bot:**

> Claro. ¿Cuál es el número de documento del cliente?

**Usuario:**

> 1234567890

**Bot:**

> ¿Cuál es el nombre del cliente?

**Usuario:**

> Juan Pérez

**Bot:**

> ¿Qué producto vendiste?

**Usuario:**

> Dos camisetas negras.

**Bot:**

> ¿Cuál es el precio por unidad?

**Usuario:**

> 50000

**Bot:**

> He preparado esta factura:
>
> Cliente: Juan Pérez  
> Documento: 1234567890  
> Producto: Camiseta negra  
> Cantidad: 2  
> Precio unitario: $50.000  
> Total estimado: $119.000
>
> ¿Deseas generar la factura?

**Usuario:**

> Sí.

**Bot:**

> ✅ Factura generada correctamente.
> Número: FEV-XXXXXX
>
> [PDF de la factura]

---

## 11. Máquina de estados

El bot necesitará conocer en qué punto de la conversación se encuentra cada usuario.

Estados iniciales propuestos:

```text
START
  |
  v
WAITING_FOR_CUSTOMER_ID
  |
  v
WAITING_FOR_CUSTOMER_NAME
  |
  v
WAITING_FOR_PRODUCT
  |
  v
WAITING_FOR_QUANTITY
  |
  v
WAITING_FOR_PRICE
  |
  v
WAITING_FOR_PAYMENT
  |
  v
WAITING_FOR_CONFIRMATION
  |
  +------ NO ------> CANCELLED
  |
 YES
  |
  v
CREATING_INVOICE
  |
  v
COMPLETED
```

Esto permite mantener una conversación organizada y saber qué dato falta en cada momento.

---

## 12. Validaciones

Antes de enviar la factura a Factus se harán validaciones básicas en nuestro backend.

Ejemplos:

- El documento del cliente no puede estar vacío.
- El nombre del cliente es obligatorio.
- Debe existir al menos un producto.
- La cantidad debe ser mayor que cero.
- El precio debe ser válido.
- La forma de pago debe ser válida.
- La factura debe tener un `reference_code` único.

Después de estas validaciones, Factus realizará sus propias validaciones y devolverá el resultado correspondiente.

---

## 13. Manejo de errores

No queremos mostrar errores técnicos directamente al usuario.

Ejemplo técnico:

```text
HTTP 422
Validation error
```

Respuesta del bot:

> ❌ No se pudo generar la factura.  
> Falta información válida del cliente. Revisa el número de documento.

El backend debe registrar el error técnico internamente y enviar al usuario un mensaje sencillo.

---

## 14. Autenticación y seguridad

### Variables de entorno

Las credenciales nunca deben quedar escritas directamente en el código.

Ejemplo:

```env
FACTUS_CLIENT_ID=...
FACTUS_CLIENT_SECRET=...
WHATSAPP_ACCESS_TOKEN=...
DATABASE_URL=...
```

El archivo `.env` debe estar incluido en `.gitignore`.

### Regla importante

```text
WhatsApp
   |
   v
Nuestro Backend
   |
   v
Factus
```

Las credenciales de Factus y WhatsApp se gestionan en el backend.

---

## 15. IA como componente diferencial

La IA no debe ser obligatoria para el primer prototipo.

Primero debe funcionar el flujo estructurado.

Después se puede agregar una capa de interpretación de lenguaje natural.

Ejemplo:

> Factura a Juan Pérez CC 1234567890, dos camisetas de 50 mil cada una y pagó en efectivo.

La IA convierte el mensaje en datos estructurados:

```json
{
  "customer": {
    "name": "Juan Pérez",
    "identification": "1234567890"
  },
  "items": [
    {
      "description": "Camiseta",
      "quantity": 2,
      "price": 50000
    }
  ],
  "payment": {
    "method": "efectivo"
  }
}
```

La IA interpreta; nuestro código valida; Factus realiza la validación final.

---

## 16. MVP

El MVP debe limitarse a un flujo pequeño pero completo.

### Funcionalidades obligatorias

1. Conectar con Factus Sandbox.
2. Autenticarse mediante OAuth2.
3. Recibir mensajes de WhatsApp.
4. Mantener una conversación básica.
5. Obtener los datos mínimos de una factura.
6. Validar los datos.
7. Mostrar una previsualización.
8. Pedir confirmación.
9. Crear/validar la factura en Factus.
10. Informar el resultado al usuario.

### Funcionalidades posteriores

- Enviar PDF por WhatsApp.
- Interpretar mensajes libres mediante IA.
- Consultar adquirientes.
- Consultar rangos automáticamente.
- Historial de facturas.
- Reintentos controlados.
- Más de un producto por factura.
- Notas crédito.

---

## 17. Tecnologías

| Componente | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Runtime | Node.js |
| Backend | Express |
| WhatsApp | WhatsApp Business Platform / Cloud API |
| Facturación | Factus API |
| Base de datos | PostgreSQL |
| Comunicación HTTP | `fetch` |
| IA | API de un LLM con salida estructurada |
| Desarrollo local | ngrok o Cloudflare Tunnel |
| Producción | VPS o plataforma cloud |

---

## 18. Estructura inicial del proyecto

```text
factus-whatsapp-bot/
│
├── src/
│   ├── server.ts
│   ├── app.ts
│   │
│   ├── routes/
│   │   ├── whatsapp.routes.ts
│   │   └── invoice.routes.ts
│   │
│   ├── controllers/
│   │   ├── whatsapp.controller.ts
│   │   └── invoice.controller.ts
│   │
│   ├── services/
│   │   ├── whatsapp.service.ts
│   │   ├── conversation.service.ts
│   │   └── invoice.service.ts
│   │
│   ├── factus/
│   │   ├── factus.auth.ts
│   │   ├── factus.client.ts
│   │   ├── factus.service.ts
│   │   └── factus.mapper.ts
│   │
│   ├── models/
│   │   └── invoice.model.ts
│   │
│   └── utils/
│
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

Esta estructura no es definitiva; puede simplificarse durante las primeras pruebas y crecer conforme el proyecto avance.

---

## 19. Orden de desarrollo

### Fase 1 — Factus Sandbox

Objetivo: generar una factura desde Node.js sin WhatsApp.

```text
Node.js
  |
  v
OAuth2
  |
  v
Factus Sandbox
  |
  v
Factura de prueba
```

### Fase 2 — Backend

Objetivo: encapsular la integración de Factus y crear las primeras rutas Express.

### Fase 3 — WhatsApp

Objetivo: recibir y responder mensajes mediante webhook.

```text
WhatsApp
   |
   v
Webhook
   |
   v
Express
```

### Fase 4 — Bot

Objetivo: desarrollar la máquina de estados y recolectar los datos necesarios.

### Fase 5 — Integración completa

Objetivo:

```text
WhatsApp
   |
   v
Bot
   |
   v
Invoice
   |
   v
Factus
   |
   v
Resultado
   |
   v
WhatsApp
```

### Fase 6 — PDF

Entregar el documento generado al usuario por WhatsApp.

### Fase 7 — IA

Permitir mensajes libres y convertirlos automáticamente en datos estructurados.

---

## 20. Primer hito técnico

El primer objetivo del proyecto será **no conectar WhatsApp todavía**.

Debemos conseguir lo siguiente:

```text
Node.js
   |
   v
OAuth2 Factus
   |
   v
Construcción de JSON
   |
   v
POST /v2/bills/validate
   |
   v
Respuesta de Factus
```

Cuando este flujo funcione correctamente podremos comenzar con la integración de WhatsApp.

Esto permite aislar problemas y evitar intentar resolver simultáneamente autenticación, webhooks, conversación y facturación.

---

## 21. Propuesta de valor

La propuesta puede resumirse en una frase:

> **“Genera tus facturas electrónicas desde WhatsApp: envía los datos de la venta y nosotros hacemos el resto mediante Factus.”**

El proyecto busca que una persona con pocos conocimientos tecnológicos pueda realizar el proceso sin necesidad de aprender un software especializado.

---

## 22. Referencias oficiales

### Factus

- Documentación: https://developers.factus.com.co/
- Facturas: https://developers.factus.com.co/facturas/
- Ejemplo de factura estándar: https://developers.factus.com.co/facturas/ejemplos/estandar-orden-servicio/

### Meta / WhatsApp

- WhatsApp Business: https://business.whatsapp.com/
- Developers / WhatsApp: https://developers.facebook.com/docs/whatsapp/
- Webhooks de WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview

---

## 23. Resumen

El sistema se basa en una arquitectura sencilla:

```text
USUARIO
   |
   v
WHATSAPP
   |
   v
WEBHOOK
   |
   v
NODE + EXPRESS
   |
   +--> Conversación
   +--> Validación
   +--> OAuth2
   +--> Factus Service
   |
   v
FACTUS API
   |
   v
FACTURA
   |
   v
WHATSAPP
```

La prioridad del proyecto es conseguir primero un flujo funcional y confiable. La IA, el historial, la entrega de PDF y otras funcionalidades serán capas adicionales después de que el núcleo de facturación esté funcionando.
