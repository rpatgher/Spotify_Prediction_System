import {
  STORAGE_KEYS,
  DEFAULT_FEATURES,
  DEFAULT_SUMMARY,
  DEFAULT_RECOMMENDATIONS,
} from "./constants.jsx";

// ============================================================
// mockAnalysisService — simulated ML + persistence layer
// ------------------------------------------------------------
// Every function here is a STUB. When the real backend exists,
// replace the bodies (marked with  // BACKEND:  comments) with
// fetch() calls. The signatures + the AnalysisResult shape are
// intentionally stable so nothing in the UI has to change.
//
// AnalysisResult shape (TS for reference):
//   id, source("youtube"|"mp3"), inputName, inputValue, createdAt,
//   rating("A".."F"), score(0-100), bestReleaseDate,
//   features[{name,value,recommendation}],
//   summary, recommendations[{title,description}]
// ============================================================

// ---- small helpers ----------------------------------------------------
function rid() {
  return "tv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function scoreToRating(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  if (score >= 35) return "E";
  return "F";
}

// Build a "Friday between +14 and +45 days from today" release date string.
function suggestReleaseDate() {
  const d = new Date();
  d.setDate(d.getDate() + randInt(14, 45));
  // nudge forward to the nearest Friday (getDay 5)
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  const out = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Capitalize first letter ("viernes, ..." -> "Viernes, ...")
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// Fallback display features (BPM + Key) used only when the backend returns
// an empty features array. Mirrors the shape extract_display_features() produces.
const _KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function buildFeatures() {
  const bpm = randInt(70, 169);
  const key = _KEYS[randInt(0, 11)];
  const major = Math.random() > 0.4;
  const scaleLabel = major ? "Mayor" : "Menor";
  return [
    {
      name: "Tempo",
      value: `${bpm} BPM`,
      recommendation: bpm < 100
        ? "Tempo moderado, versátil para pop y R&B."
        : bpm < 130
        ? "Tempo óptimo para pop y dance. Alta receptividad en streaming."
        : "Tempo rápido. Funciona bien en géneros de alta energía.",
    },
    {
      name: "Key",
      value: `${key} ${scaleLabel}`,
      recommendation: major
        ? `Tonalidad de ${key} mayor: transmite energía positiva, popular en pop comercial.`
        : `Tonalidad de ${key} menor: profundidad emocional, ideal para R&B e indie.`,
    },
  ];
}

// Core generator — produces one simulated AnalysisResult.
function generateAnalysis(source, inputName, inputValue) {
  // BACKEND: this whole function becomes the server's ML response.
  const score = randInt(38, 97); // biased toward usable, encouraging range
  return {
    id: rid(),
    source,
    inputName,
    inputValue,
    createdAt: new Date().toISOString(),
    rating: scoreToRating(score),
    score,
    bestReleaseDate: suggestReleaseDate(),
    features: buildFeatures(),
    summary: DEFAULT_SUMMARY,
    recommendations: DEFAULT_RECOMMENDATIONS,
  };
}

// ---- public API -------------------------------------------------------

// Simulated network latency so the loading state is visible.
function fakeDelay(ms = 1000) {
  return new Promise((res) => setTimeout(res, ms));
}

async function analyzeYouTubeLink(url) {
  // BACKEND: POST /api/analyze/youtube  { url }
  await fakeDelay();
  return generateAnalysis("youtube", "Análisis desde YouTube", url);
}

async function analyzeMp3File(file) {
  // BACKEND: POST /api/analyze/mp3  (multipart upload)
  await fakeDelay();
  return generateAnalysis("mp3", file.name, file.name);
}

function getHistory() {
  // BACKEND: GET /api/history
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(result) {
  // BACKEND: persistence handled server-side; this mirrors it locally.
  const list = getHistory();
  // de-dupe by id, newest first
  const next = [result, ...list.filter((r) => r.id !== result.id)];
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next));
}

function deleteFromHistory(id) {
  // BACKEND: DELETE /api/history/:id
  const next = getHistory().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next));
}

function setCurrentAnalysis(result) {
  localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(result));
}

function getCurrentAnalysis() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.current)) || null;
  } catch {
    return null;
  }
}

// ---- session (simulated auth) ----------------------------------------
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.session)) || null;
  } catch {
    return null;
  }
}
function setSession(session) {
  // BACKEND: replace with real auth token handling.
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}
function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

// ---- registered users (simulated) -------------------------------------
// Tiny local "directory" so login can recall the role chosen at registration
// without asking again. BACKEND: replace with real user lookup by credentials.
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users)) || {};
  } catch {
    return {};
  }
}
function registerUser({ name, role }) {
  const users = getUsers();
  users[name.trim().toLowerCase()] = { role };
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}
function findUserRole(name) {
  const user = getUsers()[name.trim().toLowerCase()];
  return user ? user.role : null;
}

// ============================================================
// withDummyFiller — TEMPORAL hasta que el backend devuelva todos
// los campos reales. Rellena SOLO los campos vacíos o nulos.
// ============================================================
export function withDummyFiller(result) {
  const filled = { ...result };

  if (!filled.features || filled.features.length === 0) {
    filled.features = buildFeatures();
  }

  if (!filled.summary) {
    filled.summary = DEFAULT_SUMMARY;
  }

  if (!filled.recommendations || filled.recommendations.length === 0) {
    filled.recommendations = DEFAULT_RECOMMENDATIONS;
  }

  // Layer 2: si el modelo no estaba disponible en el backend (null),
  // generamos valores mock plausibles basados en el score.
  if (filled.expectedViews == null) {
    const base = (filled.score ?? 50) / 100;
    filled.expectedViews    = Math.round((50_000 + base * 950_000) / 1000) * 1000;
    filled.expectedLikes    = Math.round(filled.expectedViews * (0.04 + base * 0.06));
    filled.expectedComments = Math.round(filled.expectedViews * (0.002 + base * 0.008));
  }

  return filled;
}

export const mockAnalysisService = {
  analyzeYouTubeLink,
  analyzeMp3File,
  getHistory,
  saveToHistory,
  deleteFromHistory,
  setCurrentAnalysis,
  getCurrentAnalysis,
  getSession,
  setSession,
  clearSession,
  registerUser,
  findUserRole,
};

Object.assign(window, { mockAnalysisService });
