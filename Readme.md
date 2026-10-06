# Factus WhatsApp Bot

**Factus WhatsApp Bot** es una solución de facturación electrónica orientada a pequeños negocios que permite generar facturas electrónicas directamente desde WhatsApp.

## Descripción

El bot integra WhatsApp Business Platform con la API de Factus para permitir que los pequeños negocios generen facturas electrónicas de forma sencilla, sin necesidad de aprender nuevos sistemas o herramientas complejas.

Solo necesitas enviar los datos de la venta por WhatsApp y el sistema se encarga de validarlos, construir la factura y enviarla a Factus.

## Ejemplo de uso

Envía un mensaje como este por WhatsApp:

```
Factura a Juan Pérez, CC 1234567890, 2 camisetas negras a 50.000 cada una, pagó en efectivo.
```

El bot:
1. Interpreta y extrae los datos
2. Valida la información
3. Muestra un resumen para confirmación
4. Genera la factura en Factus
5. Informa el resultado y entrega el PDF

## Características

- ✅ Generación de facturas desde WhatsApp
- ✅ Autenticación OAuth2 con Factus
- ✅ Validación de datos antes de enviar a Factus
- ✅ Flujo conversacional interactivo
- ✅ Soporte para producción en Factus y entornos de prueba (Sandbox)

## Tecnologías

| Componente | Tecnología |
|---|---|
| Lenguaje | JavaScript / TypeScript |
| Runtime | Node.js (>=20.6.0) |
| Backend | Express |
| WhatsApp | WhatsApp Business Platform / Cloud API |
| Facturación | Factus API |
| Base de datos | PostgreSQL (opcional para versiones futuras) |

## Estructura del proyecto

```
src/
├── controller/          # Controladores de rutas
├── factus/             # Integración con Factus (auth, client, service, mapper)
├── models/             # Modelos de datos
├── routes/             # Definición de rutas
├── services/           # Lógica de negocio
└── server.js           # Punto de entrada de la aplicación
```

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/AlbiZ27/HAKHATON_API_WARS.git
cd HAKHATON_API_WARS

# Instalar dependencias
npm install

# Crear archivo .env con las credenciales
# (ver sección de configuración)

# Iniciar el servidor
npm start
```

## Configuración

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
FACTUS_CLIENT_ID=tu_client_id
FACTUS_CLIENT_SECRET=tu_client_secret
WHATSAPP_ACCESS_TOKEN=tu_access_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
PORT=3000
```

> ⚠️ El archivo `.env` ya está incluido en `.gitignore`. Nunca commitees credenciales.

## API de Factus

El bot utiliza principalmente el endpoint de validación y creación de facturas:

```
POST /v2/bills/validate
```

Documentación oficial: https://developers.factus.com.co/

## Flujo principal

```
Usuario
  |
  v
WhatsApp
  |
  v
Webhook
  |
  v
Backend (Express)
  |
  +--> Interpretación de mensaje
  +--> Validación de datos
  +--> Autenticación OAuth2 con Factus
  +--> Conversión a formato Factus
  |
  v
Factus API
  |
  v
Resultado
  |
  v
WhatsApp (respuesta al usuario)
```

## Proyectos relacionados

- [AlbiZ27/HAKHATON_API_WARS](https://github.com/AlbiZ27/HAKHATON_API_WARS) - Repositorio oficial

## Autores

- Albi Sanchez
- Sergio Suarez
- Julian Estupiñan

## Licencia

ISC