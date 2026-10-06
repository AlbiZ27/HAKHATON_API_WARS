const { getAccessToken } = require("./factus.auth");

const BASE_URL = process.env.FACTUS_BASE_URL ?? "https://api-sandbox.factus.com.co";

class FactusApiError extends Error {
  constructor(status, body) {
    super(`Factus API error (HTTP ${status})`);
    this.name = "FactusApiError";
    this.status = status;
    this.body = body;
  }
}


async function request(method, path, payload) {
  const token = await getAccessToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const options = { method, headers };

  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new FactusApiError(response.status, data);
  }

  return data;
}

function get(path) {
  return request("GET", path);
}

function post(path, payload) {
  return request("POST", path, payload);
}

module.exports = { get, post, FactusApiError };
