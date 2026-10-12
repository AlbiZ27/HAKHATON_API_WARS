const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Indica a Puppeteer que descargue el navegador dentro de tu proyecto
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
