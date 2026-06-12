// ============================================================
// apiService — análisis real contra el backend ML
// ------------------------------------------------------------
// Solo cubre el análisis (YouTube y MP3). El historial y la
// sesión siguen siendo locales (localStorage / mockService)
// hasta que la DB de historial esté lista en el backend.
// ============================================================
import keycloak from "./keycloak.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ---- auth helper --------------------------------------------------------

async function authHeaders() {
  try {
    await keycloak.updateToken(30);
  } catch {
    // Token irrecuperable — redirigir al login.
    keycloak.login();
    // Lanzar para cortar el flujo mientras el navegador redirige.
    throw new Error("Sesión expirada, vuelve a iniciar sesión");
  }
  return { Authorization: "Bearer " + keycloak.token };
}

// ---- error handling -----------------------------------------------------

function httpError(status) {
  if (status === 401) return new Error("Sesión expirada, vuelve a iniciar sesión");
  if (status === 403) return new Error("Solo los productores pueden subir archivos");
  return new Error(`Error del servidor (${status}). Intenta de nuevo más tarde.`);
}

// ---- GET detail ---------------------------------------------------------

async function fetchResult(id, headers) {
  const res = await fetch(`${API_BASE}/api/predictions/${id}`, { headers });
  if (!res.ok) throw httpError(res.status);
  return res.json();
}

// ---- public API ---------------------------------------------------------

export async function analyzeYouTubeLink(url) {
  const headers = await authHeaders();

  const postRes = await fetch(`${API_BASE}/api/predictions/youtube`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!postRes.ok) throw httpError(postRes.status);

  const { id } = await postRes.json();
  return fetchResult(id, headers);
}

export async function analyzeMp3File(file) {
  const headers = await authHeaders();

  const form = new FormData();
  form.append("file", file);

  // No fijar Content-Type manualmente: el browser añade el boundary correcto.
  const postRes = await fetch(`${API_BASE}/api/predictions/mp3`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!postRes.ok) throw httpError(postRes.status);

  const { id } = await postRes.json();
  return fetchResult(id, headers);
}

export const apiService = { analyzeYouTubeLink, analyzeMp3File };
