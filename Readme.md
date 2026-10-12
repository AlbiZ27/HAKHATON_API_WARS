<div align="center">

# 🧾 Factus WhatsApp Bot

**Facturación electrónica (DIAN) directamente desde WhatsApp.**

Genera facturas electrónicas conversando por chat — sin ERP, sin apps complejas, sin aprender nada nuevo.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.6-339933?logo=node.js&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-whatsapp--web.js-25D366?logo=whatsapp&logoColor=white)
![Factus](https://img.shields.io/badge/Factus-API-0A66C2)
![Gemini](https://img.shields.io/badge/IA-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

</div>

---

## 📱 Probar el bot (demo para jurados)

> El bot está **desplegado y activo**. No necesitas instalar nada: solo escríbele por WhatsApp.

<div align="center">

### Escríbele al número

# � +57 305 460 5903

</div>

**Mensaje de ejemplo para empezar:**

```
Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo
```

El bot interpreta el mensaje, te pide confirmación y responde con un **enlace de descarga del PDF** de la factura generada en Factus.

> ### ⏳ Lee esto antes de probar
>
> El bot está alojado en un **servicio gratuito (Render)** que **suspende la aplicación tras un rato de inactividad**. Esto implica:
>
> - 🕐 **El primer mensaje puede tardar hasta ~1 minuto** en recibir respuesta mientras el servicio se reactiva. Si no responde de inmediato, esperá un momento y volvé a escribir — **el bot está despertando, no está caído.**
> - 🧠 **El bot no tiene memoria persistente.** El estado de cada conversación y las facturas generadas se guardan **en memoria**, no en una base de datos. Si el servicio se suspende o reinicia, **se pierde el progreso de las conversaciones en curso** (habría que empezar de nuevo con `factura`). Esto es una decisión consciente para el MVP; la persistencia en base de datos queda como mejora a futuro.

---

## 📑 Contenido

- [¿Qué hace?](#-qué-hace)
- [Cómo funciona el transporte](#-cómo-funciona-el-transporte)
- [Ejemplo de uso](#-ejemplo-de-uso)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Instalación local](#-instalación-local)
- [Configuración](#-configuración)
- [Primer arranque (vincular WhatsApp)](#-primer-arranque-vincular-whatsapp)
- [Pruebas](#-pruebas)
- [Despliegue en Render](#-despliegue-en-render)
- [Autores](#-autores)

---

## 💡 ¿Qué hace?

**Factus WhatsApp Bot** conecta una cuenta de WhatsApp con la API de **Factus** para que un pequeño negocio genere facturas electrónicas simplemente conversando por chat.

El usuario manda los datos de la venta por WhatsApp; el sistema los **interpreta**, los **valida**, construye la factura y la **envía a Factus**. La interpretación usa un **motor de reglas** rápido y, cuando el mensaje llega en lenguaje natural libre, recurre a **Google Gemini** como respaldo.

> 🎯 **Objetivo:** eliminar la barrera tecnológica de la facturación electrónica. Si sabes usar WhatsApp, sabes facturar.

---

## 🔌 Cómo funciona el transporte

A diferencia de una integración con la Meta Cloud API (webhooks HTTP), este bot usa [`whatsapp-web.js`](https://wwebjs.dev/), que controla WhatsApp Web mediante un Chromium headless (Puppeteer):

- 🔑 **Autenticación por código QR:** en el primer arranque el bot muestra un QR que se escanea desde *WhatsApp → Dispositivos vinculados*.
- 📨 Los mensajes entrantes llegan por **eventos** del cliente; las respuestas salen por el mismo cliente.
- 🚫 **No** usa tokens de la Meta Cloud API.

> ⚠️ **Sobre la sesión:** la librería puede persistir la sesión en disco (`LocalAuth`). Sin embargo, en el despliegue actual (Render, plan gratuito **sin disco persistente**) la sesión **no sobrevive** a los reinicios del contenedor, por lo que puede requerir re-vincular el QR. Ver [Limitaciones del plan gratuito](#limitaciones-del-plan-gratuito).

---

## 💬 Ejemplo de uso

**Saludá al bot:**

```
hola
```

El bot se presenta y te explica qué puede hacer. Luego podés mandar **todo junto**:

```
Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo
```

…o escribir `factura` y dejar que el bot te **guíe paso a paso**:

```
documento → nombre → productos → precio → forma de pago → correo → confirmación
```

En ambos casos, el bot:

| Paso | Acción |
|:---:|---|
| 1️⃣ | Interpreta y extrae los datos (reglas + Gemini como respaldo) |
| 2️⃣ | Pide el correo del cliente (dato del adquiriente de la factura) |
| 3️⃣ | Muestra un **resumen** para que confirmes |
| 4️⃣ | Genera la factura en **Factus** al confirmar con *"Sí"* |
| 5️⃣ | Responde con un **enlace de descarga del PDF** |

> 📎 **Sobre la entrega del PDF:** el PDF se entrega mediante un **enlace de descarga** servido por la propia aplicación, **no** como archivo adjunto. Esto es porque `whatsapp-web.js` falla al enviar archivos a chats con direccionamiento `@lid` (número enmascarado por privacidad de WhatsApp), mientras que el envío de texto —y por tanto el enlace— funciona en todos los casos. El correo del cliente se captura y se envía a Factus como dato del adquiriente; el **envío del PDF por correo lo realiza Factus en producción** (queda como escalabilidad a futuro).

---

## ✨ Características

- ✅ Transporte vía `whatsapp-web.js` (autenticación por QR)
- ✅ Generación de facturas electrónicas desde WhatsApp
- ✅ Interpretación por reglas con **respaldo de Gemini** para lenguaje natural
- ✅ Saludo con presentación del bot
- ✅ Captura del correo del cliente (adquiriente de la factura)
- ✅ Entrega del PDF mediante **enlace de descarga**
- ✅ Autenticación **OAuth2** con Factus
- ✅ Validación de datos antes de enviar a Factus
- ✅ Flujo conversacional interactivo (máquina de estados)
- ✅ Soporte para **Sandbox** y **producción** de Factus
- ✅ Desplegado en **Render** (servicio gratuito)

---

## 🛠 Tecnologías

| Componente | Tecnología |
|---|---|
| Lenguaje | JavaScript (CommonJS) |
| Runtime | Node.js (>=20.6.0) |
| HTTP | Express (endpoints `/health` y descarga de PDF) |
| WhatsApp | `whatsapp-web.js` + `qrcode-terminal` (Puppeteer/Chromium) |
| IA (respaldo) | Google Gemini API |
| Facturación | Factus API |
| Pruebas | `node --test` + `fast-check` (property-based testing) |
| Despliegue | Render (Docker) |

---

## 📁 Estructura del proyecto

```
src/
├── controller/
│   └── whatsapp.controller.js   # Business_Flow: receiveMessage (orquesta la conversación)
├── factus/                      # Integración con Factus (auth, client, service, mapper)
├── models/                      # Modelo interno de factura y validación
├── services/
│   ├── conversation.service.js  # Estado de la conversación (en memoria)
│   ├── llm.service.js           # Interpretación por reglas + respaldo Gemini
│   ├── gemini.service.js        # Cliente de la API de Gemini (fallback de extracción)
│   ├── pdf-store.service.js     # Almacena el PDF en memoria y expone un enlace de descarga
│   └── whatsapp.service.js      # Envío de mensajes (outbound) vía el cliente
├── whatsapp/
│   ├── whatsapp.client.js       # Cliente whatsapp-web.js: ciclo de vida y envío
│   ├── whatsapp.handler.js      # Normaliza el mensaje entrante y despacha la respuesta
│   └── whatsapp.normalize.js    # Helpers puros: filtrado y normalización de IDs
├── app.js                       # Express: /health + descarga del PDF
└── server.js                    # Punto de entrada: inicializa el cliente y escucha
```

---

## 💻 Instalación local

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

---

## ⚙️ Configuración

Copiá `.env.example` a `.env` y completá los valores. Variables principales:

```env
# Factus
FACTUS_USERNAME=...
FACTUS_PASSWORD=...
FACTUS_CLIENT_ID=...
FACTUS_CLIENT_SECRET=...
FACTUS_BASE_URL=https://api-sandbox.factus.com.co

# WhatsApp (whatsapp-web.js) — opcionales, con valores por defecto
WHATSAPP_SESSION_PATH=./.wwebjs_auth
WHATSAPP_CLIENT_ID=factus-bot

# Gemini (respaldo de interpretación en lenguaje natural)
GEMINI_API_KEY=...
# Opcionales:
# GEMINI_MODEL=gemini-3.5-flash-lite
# GEMINI_TIMEOUT_MS=8000

# Servidor
PORT=3000
# URL pública para construir los enlaces de descarga del PDF
# (en local: http://localhost:3000 ; en Render: la URL del servicio)
PUBLIC_BASE_URL=http://localhost:3000
```

> ⚠️ El `.env` está en `.gitignore`. **Nunca se commitean credenciales.** Usá `.env.example` como plantilla pública.

---

## 🔗 Primer arranque (vincular WhatsApp)

1. `npm start`
2. Esperá a ver `[whatsapp.client] lifecycle -> qr_pending` y el **QR en la terminal**.
3. En el teléfono: *WhatsApp → Dispositivos vinculados → Vincular un dispositivo* y escaneá el QR.
4. Cuando veas `lifecycle -> ready`, el bot está **conectado**.
5. Escribile al bot **desde otro número** (los mensajes propios y de grupos se ignoran).

> Verificá el estado del servicio con `curl http://localhost:3000/health`.

---

## 🧪 Pruebas

```bash
npm test   # node --test
```

Incluye tests unitarios, de resiliencia y **property-based tests** (`fast-check`) sobre el núcleo de normalización del transporte y la descarga del PDF.

---

## ☁️ Despliegue en Render

El bot está desplegado como **Web Service** en [Render](https://render.com/) (plan gratuito), lo que lo mantiene corriendo como un **proceso permanente** que escucha WhatsApp.

**Lo que se configuró:**

- **Tipo de servicio:** Web Service (proceso continuo — el bot mantiene abierta la sesión de WhatsApp, por lo que un entorno *serverless* no sirve).
- **Entorno:** Docker, para dar soporte nativo a Chromium/Puppeteer.
- **Build:** `npm install` (Puppeteer prepara su Chromium).
- **Start:** `node src/server.js`.
- **Variables de entorno:** se configuran en el panel de Render (*Environment*), **no** con un archivo `.env`. Incluyen las credenciales de Factus, `GEMINI_API_KEY` y `PUBLIC_BASE_URL` (la URL pública que asigna Render, usada para construir los enlaces de descarga del PDF).
- **Chromium/Puppeteer:** se ejecuta headless con los flags `--no-sandbox --disable-setuid-sandbox`, requeridos en entornos contenerizados.
- **Vinculación de WhatsApp:** el QR del primer arranque se escanea **leyéndolo desde los logs** del servicio en Render.

### Limitaciones del plan gratuito

- ⏳ **Suspensión por inactividad:** Render apaga el servicio tras un período sin tráfico y lo reactiva al llegar una nueva petición → de ahí el **retraso de hasta ~1 minuto** en la primera interacción.
- 🧠 **Sin memoria persistente:** el estado de las conversaciones y las facturas viven **en memoria**. Un reinicio o suspensión **borra ese estado** (y puede requerir re-escanear el QR, al no haber disco persistente). La persistencia en base de datos queda como mejora futura.

---

## 📚 API de Factus

Documentación oficial: https://developers.factus.com.co/

---

## 👥 Autores

- **Albi Sánchez**
- **Sergio Suárez**
- **Julián Estupiñán**

---

## 📄 Licencia

Distribuido bajo licencia **ISC**.
