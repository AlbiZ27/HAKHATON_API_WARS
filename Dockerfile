# Utiliza una imagen oficial de Node que ya incluya Chrome y sus dependencias de Linux
FROM ghcr.io/puppeteer/puppeteer:22.11.1

# Cambiar al usuario root temporalmente para estructurar carpetas
USER root

# Crear el directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias limpias
RUN npm install

# Copiar todo el código de tu proyecto al contenedor
COPY . .

# Exponer el puerto que usa tu servidor en Render (10000)
EXPOSE 3000

# Comando para iniciar tu bot
CMD ["node", "src/server.js"]