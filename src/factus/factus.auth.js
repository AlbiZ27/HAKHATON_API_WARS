const BASE_URL = process.env.FACTUS_BASE_URL ?? "https://api-sandbox.factus.com.co";
const TOKEN_URL = `${BASE_URL}/oauth/token`;

// In-memory token cache. Lives as long as the process runs.
// We store the token plus the timestamp (ms) at which it expires.
let cachedToken = null; // { accessToken, refreshToken, expiresAt }

// Safety margin: renew the token 60s before it actually expires,
// so a request never fails mid-flight because the token died by a second.
const EXPIRY_MARGIN_MS = 60 * 1000;

function getCredentials() {
  const credentials = {
    grant_type: "password",
    client_id: process.env.FACTUS_CLIENT_ID,
    client_secret: process.env.FACTUS_CLIENT_SECRET,
    username: process.env.FACTUS_USERNAME,
    password: process.env.FACTUS_PASSWORD,
  };

  const missing = Object.entries(credentials)
    .filter(([key, value]) => key !== "grant_type" && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Factus credentials in environment: ${missing.join(", ")}`
    );
  }

  return credentials;
}

async function requestNewToken() {
  const credentials = getCredentials();
  const body = new URLSearchParams(credentials);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Factus authentication failed (HTTP ${response.status}): ${detail}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function getAccessToken() {
  const stillValid =
    cachedToken && Date.now() < cachedToken.expiresAt - EXPIRY_MARGIN_MS;

  if (stillValid) {
    return cachedToken.accessToken;
  }

  cachedToken = await requestNewToken();
  return cachedToken.accessToken;
}

module.exports = { getAccessToken };
