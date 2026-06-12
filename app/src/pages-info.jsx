// ============================================================
// InfoPage — qué hace el modelo, cómo funciona y qué significan
// las calificaciones. Lenguaje de marketing, alto nivel.
// ============================================================
import React from "react";
import { PROJECT_NAME, RATING_TEXT, RATING_HUE } from "./constants.jsx";
import { Icon, Card } from "./components.jsx";
import { PageHeader } from "./layout.jsx";

const STEPS = [
  {
    icon: "upload",
    title: "1 · Escuchamos tu canción",
    text: "Sube un MP3 o pega un enlace de YouTube. Nuestro sistema analiza el audio y extrae decenas de señales musicales: energía, tempo, tonalidad, dinámica y mucho más.",
    h: 162,
  },
  {
    icon: "sparkle",
    title: "2 · La comparamos con miles de éxitos",
    text: "Un modelo de Machine Learning, entrenado con datos reales de Spotify y YouTube, contrasta esas señales con los patrones que comparten las canciones que triunfan.",
    h: 178,
  },
  {
    icon: "chart",
    title: "3 · Te damos un veredicto claro",
    text: "Obtienes un score de 0 a 100, una calificación de A a F y una estimación de vistas, likes y comentarios que tu canción podría alcanzar en YouTube.",
    h: 150,
  },
];

const RATING_ORDER = ["A", "B", "C", "D", "E", "F"];

const RATING_DETAIL = {
  A: "Tu canción comparte el ADN de los grandes éxitos. Es el momento de apostar fuerte por su lanzamiento.",
  B: "Señales muy sólidas. Con una buena estrategia de promoción puede destacar en su segmento.",
  C: "Tiene base para competir, aunque hay margen de mejora antes del lanzamiento.",
  D: "Algunas señales juegan en contra. Conviene revisar producción o enfoque antes de invertir.",
  E: "El modelo detecta poca afinidad con los patrones de éxito actuales. Vale la pena iterar.",
  F: "La canción necesita ajustes importantes para acercarse a lo que el mercado está premiando.",
};

export function InfoPage({ navigate, session }) {
  return (
    <>
      <PageHeader
        title={`¿Cómo funciona ${PROJECT_NAME}?`}
        subtitle="Tu canción, analizada con la misma inteligencia de datos que mueve a la industria musical."
      />

      {/* ===== qué hace ===== */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="music" className="w-5 h-5" style={{ color: "oklch(0.74 0.16 162)" }} />
          <h3 className="font-display text-lg font-bold text-white">¿Qué hace el modelo?</h3>
        </div>
        <p className="text-[14.5px] text-white/60 leading-relaxed">
          {PROJECT_NAME} predice el potencial de éxito de tu canción <strong className="text-white/85">antes de lanzarla</strong>.
          Analizamos el audio con tecnología de Machine Learning entrenada sobre datos reales de Spotify y YouTube,
          y te devolvemos un veredicto claro: qué tan lejos puede llegar tu música y qué nivel de engagement puedes
          esperar. Deja de adivinar — lanza con datos.
        </p>
      </Card>

      {/* ===== cómo funciona ===== */}
      <div>
        <h3 className="font-display text-lg font-bold text-white mb-4">¿Cómo funciona?</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map(({ icon, title, text, h }) => (
            <Card key={title} className="p-5 flex flex-col gap-3">
              <span
                className="grid place-items-center w-10 h-10 rounded-xl"
                style={{ background: `oklch(0.66 0.18 ${h} / 0.14)`, color: `oklch(0.74 0.16 ${h})` }}
              >
                <Icon name={icon} className="w-5 h-5" />
              </span>
              <div className="font-semibold text-white text-[15px]">{title}</div>
              <p className="text-[13.5px] text-white/55 leading-relaxed">{text}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ===== calificaciones ===== */}
      <div>
        <h3 className="font-display text-lg font-bold text-white mb-1">Las calificaciones</h3>
        <p className="text-[14px] text-white/50 mb-4 leading-relaxed">
          Cada análisis genera un score predictivo de 0 a 100 que se traduce en una letra, de A (máximo potencial)
          a F (necesita trabajo). Así puedes leer tu resultado de un vistazo.
        </p>
        <div className="flex flex-col gap-3">
          {RATING_ORDER.map((r) => {
            const hue = RATING_HUE[r];
            return (
              <Card key={r} className="p-4 flex items-center gap-4">
                <div
                  className="grid place-items-center rounded-2xl font-display font-bold shrink-0"
                  style={{
                    width: 52, height: 52, fontSize: 26,
                    color: `oklch(0.8 0.16 ${hue})`,
                    background: `oklch(0.74 0.17 ${hue} / 0.14)`,
                    border: `1.5px solid oklch(0.74 0.17 ${hue} / 0.4)`,
                  }}
                >
                  {r}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white text-[15px]">{RATING_TEXT[r]}</div>
                  <p className="text-[13px] text-white/50 leading-relaxed">{RATING_DETAIL[r]}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ===== CTA ===== */}
      <Card className="p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-display text-lg font-bold text-white">¿Lista tu próxima canción?</div>
          <p className="text-[13.5px] text-white/50 mt-1">Descubre su potencial en segundos.</p>
        </div>
        <button
          onClick={() => navigate(session.role === "producer" ? "/producer" : "/user")}
          className="btn-primary whitespace-nowrap"
        >
          <Icon name="sparkle" className="w-4 h-4" /> Analizar ahora
        </button>
      </Card>
    </>
  );
}
