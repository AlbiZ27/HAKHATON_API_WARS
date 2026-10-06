# Factus WhatsApp Bot

**Factus WhatsApp Bot** es una solución de facturación electrónica orientada a pequeños negocios que permite generar facturas electrónicas (DIAN) directamente desde WhatsApp.

## Descripción

El bot conecta una cuenta de WhatsApp (vía `whatsapp-web.js`) con la API de Factus para que un negocio genere facturas electrónicas conversando por chat, sin aprender sistemas nuevos.

El usuario envía los datos de la venta por WhatsApp y el sistema los interpreta, valida, construye la factura y la envía a Factus. La interpretación del mensaje usa un motor de reglas rápido y, cuando el mensaje viene en lenguaje natural libre, recurre a Gemini como respaldo.

## Cómo funciona el transporte

A diferencia de una integración con la Meta Cloud API (webhooks HTTP), este bot usa [`whatsapp-web.js`](https://wwebjs.dev/), que controla WhatsApp Web a través de un Chromium headless (Puppeteer):

- La autenticación es por **código QR**: en el primer arranque el bot muestra un QR en la terminal que se escanea desde *WhatsApp → Dispositivos vinculados*.
- La sesión se **persiste** en disco (`LocalAuth`), así que los reinicios no vuelven a pedir el QR.
- Los mensajes entrantes llegan por eventos del cliente; las respuestas salen por el mismo cliente.
- No se usan tokens de la Meta Cloud API.

## Ejemplo de uso

Saludá al bot:

```
hola
```

El bot se presenta y explica qué puede hacer. Luego podés mandar todo junto:

```
Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo
```

O escribir `factura` y el bot te guía paso a paso: documento → nombre → productos → precio → forma de pago → **correo de envío** → confirmación.

En ambos casos el bot:
1. Interpreta y extrae los datos (reglas + Gemini como respaldo)
2. Pregunta el correo al que se enviará la factura (si no vino en el mensaje)
3. Muestra un resumen para confirmación
4. Genera la factura en Factus al confirmar con "Sí"
5. Informa el resultado; Factus envía el PDF al correo indicado

## Características

- ✅ Transporte vía `whatsapp-web.js` (QR + sesión persistente)
- ✅ Generación de facturas desde WhatsApp
- ✅ Interpretación por reglas con respaldo de Gemini para lenguaje natural
- ✅ Saludo con presentación del bot
- ✅ Captura del correo de destino de la factura
- ✅ Autenticación OAuth2 con Factus
- ✅ Validación de datos antes de enviar a Factus
- ✅ Flujo conversacional interactivo
- ✅ Soporte para Sandbox y producción de Factus

## Tecnologías

| Componente | Tecnología |
|---|---|
| Lenguaje | JavaScript (CommonJS) |
| Runtime | Node.js (>=20.6.0) |
| HTTP | Express (solo endpoint `/health`) |
| WhatsApp | `whatsapp-web.js` + `qrcode-terminal` (Puppeteer/Chromium) |
| IA (respaldo) | Google Gemini API |
| Facturación | Factus API |
| Pruebas | `node --test` + `fast-check` (property-based testing) |

## Requisitos del sistema

`whatsapp-web.js` requiere un **Chromium / navegador headless** disponible en el host (Puppeteer). En Linux, instalá Chromium del sistema o dejá que Puppeteer descargue el suyo.

## Estructura del proyecto

```
src/
├── controller/
│   └── whatsapp.controller.js   # Business_Flow: receiveMessage (sin cambios por la migración)
├── factus/                      # Integración con Factus (auth, client, service, mapper)
├── models/                      # Modelo interno de factura y validación
├── services/
│   ├── conversation.service.js  # Estado de la conversación
│   ├── llm.service.js           # Interpretación por reglas + respaldo Gemini
│   ├── gemini.service.js        # Cliente de la API de Gemini (fallback de extracción)
│   └── whatsapp.service.js      # Envío de mensajes (outbound) vía el cliente
├── whatsapp/
│   ├── whatsapp.client.js       # Cliente whatsapp-web.js: ciclo de vida y envío
│   ├── whatsapp.handler.js      # Normaliza el mensaje entrante y despacha la respuesta
│   └── whatsapp.normalize.js    # Helpers puros: filtrado y normalización de IDs
├── app.js                       # Express + /health (reporta el estado del cliente)
└── server.js                    # Punto de entrada: inicializa el cliente y escucha
```

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/AlbiZ27/HAKHATON_API_WARS.git
cd HAKHATON_API_WARS

# Instalar dependencias
npm install

# Crear el .env a partir del ejemplo y completar credenciales
cp .env.example .env

# Iniciar el bot (muestra el QR en la terminal la primera vez)
npm start
```

## Configuración

Copiá `.env.example` a `.env` y completá los valores. Variables principales:

```env
# Factus
FACTUS_USERNAME=...
FACTUS_PASSWORD=...
FACTUS_CLIENT_ID=...
FACTUS_CLIENT_SECRET=...
FACTUS_BASE_URL=https://api-sandbox.factus.com.co

# WhatsApp (whatsapp-web.js) — ambas opcionales, con valores por defecto
WHATSAPP_SESSION_PATH=./.wwebjs_auth
WHATSAPP_CLIENT_ID=factus-bot

# Gemini (respaldo de interpretación en lenguaje natural)
GEMINI_API_KEY=...
# Opcionales:
# GEMINI_MODEL=gemini-3.5-flash-lite
# GEMINI_TIMEOUT_MS=8000

# Servidor
PORT=3000
```

> ⚠️ El `.env` está en `.gitignore`. Nunca se commitean credenciales. Usá `.env.example` como plantilla pública.

## Primer arranque (vincular WhatsApp)

1. `npm start`
2. Esperá a ver `[whatsapp.client] lifecycle -> qr_pending` y el QR en la terminal.
3. En el teléfono: *WhatsApp → Dispositivos vinculados → Vincular un dispositivo* y escaneá el QR.
4. Cuando veas `lifecycle -> ready`, el bot está conectado.
5. Escribile al bot **desde otro número** (los mensajes propios y de grupos se ignoran).

Verificá el estado con `curl http://localhost:3000/health`.

## Pruebas

```bash
npm test   # node --test
```

Incluye tests unitarios, de resiliencia y property-based tests (`fast-check`) sobre el núcleo de normalización del transporte.

## API de Factus

Documentación oficial: https://developers.factus.com.co/

## Autores

- Albi Sanchez
- Sergio Suarez
- Julian Estupiñan

## Licencia

ISC
