/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // The base Docker image (ghcr.io/puppeteer/puppeteer) already ships a Chrome
  // binary, and whatsapp-web.js is pointed at it via PUPPETEER_EXECUTABLE_PATH.
  // whatsapp-web.js depends on the full `puppeteer` package, which would
  // otherwise download its own Chrome on install, bloating the image and
  // introducing a mismatched browser version.
  skipDownload: true,
};
