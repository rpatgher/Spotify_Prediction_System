// ============================================================
// TrackVision AI — Global constants
// Centralized so the brand name / mock data can be swapped easily
// when the real backend is connected.
// ============================================================

// Project name lives in ONE place — change here to rebrand everywhere.
const PROJECT_NAME = "TrackVision AI";
const PROJECT_TAGLINE =
  "Predicción musical basada en datos de Spotify, YouTube y Machine Learning.";

// LocalStorage keys (kept identical to the backend spec)
const STORAGE_KEYS = {
  session: "trackvision_session",
  current: "trackvision_current_analysis",
  history: "trackvision_history",
};

// Rating letter -> short verdict copy
const RATING_TEXT = {
  A: "Alto potencial de éxito",
  B: "Buen potencial",
  C: "Potencial medio",
  D: "Riesgo moderado",
  E: "Bajo potencial",
  F: "Requiere ajustes importantes",
};

// Accent hue per rating (oklch hue) — green(good) → red(bad)
const RATING_HUE = { A: 150, B: 155, C: 95, D: 70, E: 35, F: 25 };

// Default feature set — values get re-randomized per analysis in the mock
// service, but the NAMES + recommendations are defined here as an array
// (never hard-coded inside JSX) so the backend can replace them 1:1.
const DEFAULT_FEATURES = [
  {
    name: "Reproducciones estimadas",
    value: "120K - 250K",
    recommendation:
      "Aumentar expectativa con campaña previa en redes sociales.",
  },
  {
    name: "Vistas potenciales en YouTube",
    value: "80K - 180K",
    recommendation: "Crear teaser visual y usar miniatura llamativa.",
  },
  {
    name: "Engagement esperado",
    value: "7.8%",
    recommendation:
      "Impulsar comentarios, guardados y compartidos durante los primeros días.",
  },
];

// Default recommendation blocks shown on the results screen.
const DEFAULT_RECOMMENDATIONS = [
  {
    title: "Lanzar con campaña previa",
    description: "Publica adelantos entre 7 y 10 días antes del lanzamiento.",
  },
  {
    title: "Optimizar contenido visual",
    description:
      "Utiliza una portada y miniatura que comuniquen claramente el mood de la canción.",
  },
  {
    title: "Impulsar interacción inicial",
    description:
      "Durante las primeras 48 horas, enfócate en comentarios, compartidos y guardados.",
  },
];

const DEFAULT_SUMMARY =
  "De acuerdo con la información procesada, la canción tiene un potencial competitivo dentro de su segmento. Las métricas simuladas muestran una buena posibilidad de alcance si se acompaña de una estrategia de lanzamiento constante, contenido visual atractivo y promoción previa.";

const RELEASE_DATE_NOTE =
  "El sistema sugiere esta fecha porque los viernes suelen concentrar mayor actividad de lanzamientos musicales y consumo en plataformas digitales. Esta recomendación se genera de forma simulada y podrá conectarse después al modelo real.";

Object.assign(window, {
  PROJECT_NAME,
  PROJECT_TAGLINE,
  STORAGE_KEYS,
  RATING_TEXT,
  RATING_HUE,
  DEFAULT_FEATURES,
  DEFAULT_RECOMMENDATIONS,
  DEFAULT_SUMMARY,
  RELEASE_DATE_NOTE,
});
