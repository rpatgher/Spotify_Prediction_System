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

// Re-randomize feature display values around the defaults for realism.
function buildFeatures() {
  const plays = [randInt(60, 200), 0];
  plays[1] = plays[0] + randInt(60, 180);
  const views = [randInt(40, 150), 0];
  views[1] = views[0] + randInt(50, 140);
  const eng = (Math.random() * 8 + 3).toFixed(1);
  return [
    { ...DEFAULT_FEATURES[0], value: `${plays[0]}K - ${plays[1]}K` },
    { ...DEFAULT_FEATURES[1], value: `${views[0]}K - ${views[1]}K` },
    { ...DEFAULT_FEATURES[2], value: `${eng}%` },
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
