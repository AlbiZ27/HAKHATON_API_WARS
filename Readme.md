<div align="center">
🧾 Factus WhatsApp Bot
Facturación electrónica (DIAN) desde WhatsApp, conversando por chat

Sin ERP, sin apps complejas, sin curva de aprendizaje.<br/> Si sabes usar WhatsApp, sabes facturar.

Mostrar imagen Mostrar imagen Mostrar imagen Mostrar imagen Mostrar imagen Mostrar imagen Mostrar imagen

Probar la demo · Cómo funciona · Decisiones técnicas · Instalación · Roadmap

</div>
🎯 El problema y la solución

Facturar electrónicamente en Colombia exige software, certificados y conocimiento técnico que muchos pequeños negocios no tienen. Terminan facturando a mano, tarde o directamente sin facturar.

Factus WhatsApp Bot lleva esa tarea a la herramienta que ya usan todo el día. El comerciante escribe la venta en una frase; el bot la interpreta, la valida, pide confirmación y emite la factura en Factus, devolviendo el PDF listo para descargar.

📱 Prueba el bot (demo para jurados)

El bot está desplegado y activo. No necesitas instalar nada: escríbele por WhatsApp.

<div align="center">
📞 +57 305 460 5903
</div>

Envía hola para que se presente, o pega directamente este mensaje:

Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo

Así se ve una conversación (ejemplo ilustrativo; el texto exacto del bot puede variar):

👤  Factura a Juan Pérez, CC 1234567890, 2 camisetas negras
    a 50.000 cada una, pagó en efectivo

🤖  Casi listo. ¿Cuál es el correo del cliente?

👤  juan@correo.com

🤖  📋 Resumen de la factura
    • Cliente: Juan Pérez · CC 1234567890
    • 2 × Camiseta negra · $50.000 c/u
    • Pago: efectivo
    ¿Confirmas? (Sí / No)

👤  Sí

🤖  ✅ Factura generada. Descarga el PDF aquí: https://…
⏳ Léelo antes de probar

El bot corre en el plan gratuito de Render, que suspende la app tras un rato de inactividad.

🕐 El primer mensaje puede tardar hasta ~1 minuto. Si no responde, espera y vuelve a escribir: el bot está despertando, no está caído.
🧠 No hay memoria persistente. Conversaciones y facturas viven en memoria; si el servicio se suspende o reinicia, pierdes el progreso en curso y debes empezar de nuevo con factura. Es una decisión consciente del MVP (ver Roadmap).
📲 Escríbele desde otro número: los mensajes propios y los de grupos se ignoran.
🧪 Las facturas se generan en el ambiente Sandbox de Factus.
<!-- 📸 Agrega aquí capturas de pantalla de la conversación y del PDF generado: ![Conversación](docs/conversacion.png) ![Factura](docs/factura.png) -->
✨ Características
	
💬 Conversacional	Factura en una sola frase o guiada paso a paso
🧠 Interpretación híbrida	Motor de reglas rápido + Google Gemini como respaldo para lenguaje libre
✅ Validación previa	Verifica los datos antes de enviarlos a Factus
🧾 Confirmación explícita	Muestra un resumen y solo emite al responder "Sí"
📧 Datos del adquiriente	Captura el correo del cliente y lo envía a Factus
📎 PDF al instante	Entrega un enlace de descarga de la factura
🔐 OAuth2 con Factus	Autenticación gestionada por la integración
🌗 Sandbox y producción	Cambia de ambiente con una variable de entorno
⚙️ Cómo funciona
Flujo de una factura
Factus
Gemini
Bot
Factus
Gemini
Bot
opt
[Las reglas no alcanzan
(lenguaje libre)]
Usuario
"Factura a Juan Pérez, CC 123…, 2 camisetas a 50.000…"
Motor de reglas extrae los datos
Extracción con IA (respaldo)
Datos estructurados
Pide lo que falta (p. ej. correo)
Resumen y "¿Confirmas?"
"Sí"
Autenticación OAuth2 + crear factura
Factura validada + PDF
Enlace de descarga del PDF
Usuario
Modo guiado

Si escribes solo factura, el bot te lleva por una máquina de estados:

Sí
No
Documento
Nombre
Productos
Precio
Forma de pago
Correo
Confirmación
Factura en Factus
Arquitectura
respaldo
WhatsApp
whatsapp-web.jsChromium headless
Handler
Business flowcontroller
Reglas
Gemini
Estadoen memoria
Factus APIOAuth2
PDF store
Expressenlace de descarga
🧭 Decisiones técnicas
Decisión	Por qué
whatsapp-web.js en vez de la Meta Cloud API	Permite usar un número normal con vinculación por QR, sin aprobación de Meta ni plantillas: ideal para validar el producto rápido. Controla WhatsApp Web con Chromium headless (Puppeteer).
Reglas primero, Gemini de respaldo	Las reglas resuelven los casos comunes al instante y sin costo; la IA solo entra cuando el mensaje es lenguaje natural libre, con timeout configurable.
PDF por enlace, no como adjunto	whatsapp-web.js falla al enviar archivos a chats con direccionamiento @lid (número enmascarado por WhatsApp). El texto funciona siempre, así que el enlace es fiable en todos los casos.
Estado en memoria	Simplifica el MVP. La persistencia en base de datos está planificada.
Proceso permanente (no serverless)	El bot mantiene abierta la sesión de WhatsApp, por lo que necesita un servicio siempre activo.
Correo capturado, envío a cargo de Factus	El correo se manda a Factus como dato del adquiriente; en producción es Factus quien envía el PDF por email.
🛠 Tecnologías
Componente	Tecnología
Lenguaje / runtime	JavaScript (CommonJS) · Node.js ≥ 20.6
HTTP	Express (/health y descarga de PDF)
WhatsApp	whatsapp-web.js + qrcode-terminal (Puppeteer/Chromium)
IA (respaldo)	Google Gemini API
Facturación	Factus API
Pruebas	node --test + fast-check (property-based testing)
Despliegue	Render (Docker)
📁 Estructura del proyecto
src/
├── controller/
│   └── whatsapp.controller.js   # Business_Flow: orquesta la conversación
├── factus/                      # Integración con Factus (auth, client, service, mapper)
├── models/                      # Modelo interno de factura y validación
├── services/
│   ├── conversation.service.js  # Estado de la conversación (en memoria)
│   ├── llm.service.js           # Interpretación por reglas + respaldo Gemini
│   ├── gemini.service.js        # Cliente de la API de Gemini
│   ├── pdf-store.service.js     # Guarda el PDF en memoria y expone el enlace
│   └── whatsapp.service.js      # Envío de mensajes (outbound)
├── whatsapp/
│   ├── whatsapp.client.js       # Cliente whatsapp-web.js: ciclo de vida y envío
│   ├── whatsapp.handler.js      # Normaliza el mensaje entrante y despacha
│   └── whatsapp.normalize.js    # Helpers puros: filtrado y normalización de IDs
├── app.js                       # Express: /health + descarga del PDF
└── server.js                    # Punto de entrada
💻 Instalación local

Requisitos: Node.js ≥ 20.6 · credenciales de Factus (el Sandbox sirve) · API key de Gemini (opcional pero recomendada).

bash
git clone https://github.com/AlbiZ27/HAKHATON_API_WARS.git
cd HAKHATON_API_WARS
npm install
cp .env.example .env    # completa las credenciales
npm start               # muestra el QR en la terminal la primera vez
Configuración
Variable	Descripción	Requerida
FACTUS_USERNAME · FACTUS_PASSWORD	Usuario de Factus	✅
FACTUS_CLIENT_ID · FACTUS_CLIENT_SECRET	Credenciales OAuth2	✅
FACTUS_BASE_URL	https://api-sandbox.factus.com.co para Sandbox	✅
PUBLIC_BASE_URL	URL pública para los enlaces de PDF. Local: http://localhost:3000; Render: la URL del servicio	✅
GEMINI_API_KEY	Respaldo de interpretación con IA	Recomendada
GEMINI_MODEL	Modelo de Gemini a usar	—
GEMINI_TIMEOUT_MS	Timeout de Gemini en ms (ej. 8000)	—
WHATSAPP_SESSION_PATH	Carpeta de la sesión (./.wwebjs_auth)	—
WHATSAPP_CLIENT_ID	ID del cliente (factus-bot)	—
PORT	Puerto del servidor (3000)	—

⚠️ .env está en .gitignore. Nunca subas credenciales; usa .env.example como plantilla pública.

Vincular WhatsApp (primer arranque)
Ejecuta npm start.
Espera [whatsapp.client] lifecycle -> qr_pending y el QR en la terminal.
En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo y escanea el QR.
Cuando veas lifecycle -> ready, el bot está conectado.
Escríbele desde otro número.

Comprueba el estado del servicio con curl http://localhost:3000/health.

🧪 Pruebas
bash
npm test

Incluye pruebas unitarias, de resiliencia y property-based (fast-check) sobre la normalización del transporte y la descarga del PDF.

☁️ Despliegue en Render

Desplegado como Web Service (plan gratuito).

Aspecto	Configuración
Entorno	Docker (soporte nativo de Chromium/Puppeteer)
Build · Start	npm install · node src/server.js
Variables	Panel Environment de Render (no se usa .env); incluye PUBLIC_BASE_URL
Chromium	Headless con --no-sandbox --disable-setuid-sandbox (requerido en contenedores)
Vinculación	El QR del primer arranque se escanea desde los logs de Render

Limitaciones del plan gratuito

⏳ Suspensión por inactividad: el servicio se apaga sin tráfico y se reactiva con la siguiente petición (de ahí el retraso de ~1 min).
🧠 Sin persistencia: conversaciones, facturas y sesión de WhatsApp se pierden al reiniciar; puede ser necesario re-escanear el QR.
🩺 Solución de problemas
<details> <summary><b>Ver síntomas frecuentes y cómo resolverlos</b></summary> <br/>
Síntoma	Causa probable	Qué hacer
El bot no responde	Servicio suspendido en Render	Espera ~1 min y reenvía el mensaje
Te pide empezar de nuevo	Estado en memoria perdido por reinicio	Escribe factura
No aparece el QR o la sesión se cayó	Sesión no persistida	Revisa los logs y vuelve a escanear
No responde a tus propios mensajes	Los mensajes propios se ignoran	Escribe desde otro número
Error de autenticación con Factus	Credenciales o FACTUS_BASE_URL incorrectos	Revisa las variables de entorno
El enlace del PDF no abre	PUBLIC_BASE_URL mal configurada, o PDF perdido tras un reinicio	Corrige la URL o genera la factura de nuevo
</details>
🗺 Roadmap
 Persistencia en base de datos (conversaciones, facturas y sesión)
 Envío del PDF por correo al cliente (Factus en producción)
 Migración a la Meta Cloud API para mayor estabilidad
 Multiusuario / multiempresa
 Notas crédito y consulta de facturas emitidas
📚 Recursos
Documentación de la API de Factus
whatsapp-web.js
👥 Autores
	
Albi Sánchez	Sergio Suárez · Julián Estupiñán
<div align="center">

Distribuido bajo licencia ISC.

</div>
