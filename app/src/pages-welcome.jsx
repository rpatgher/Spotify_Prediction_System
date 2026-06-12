// ============================================================
// WelcomePage — landing screen shown before authentication
// ============================================================
import React from "react";
import { PROJECT_NAME, PROJECT_TAGLINE } from "./constants.jsx";
import { Icon, Wordmark, GradientOrbs } from "./components.jsx";

export function WelcomePage({ onStart }) {
  return (
    <div
      className="relative min-h-full grid place-items-center overflow-hidden p-6"
      style={{ background: "linear-gradient(160deg, oklch(0.2 0.04 162), oklch(0.16 0.03 270))" }}
    >
      <GradientOrbs />

      <div className="relative z-10 flex flex-col items-center text-center max-w-xl gap-6">
        <Wordmark size={56} />

        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/70 whitespace-nowrap"
          style={{ background: "oklch(1 0 0 / 0.06)", border: "1px solid oklch(1 0 0 / 0.08)" }}
        >
          <Icon name="wave" className="w-4 h-4" /> Spotify · YouTube · Machine Learning
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.05]">
          Bienvenido a <span style={{ color: "oklch(0.78 0.15 162)" }}>{PROJECT_NAME}</span>
        </h1>

        <p className="text-white/55 text-[16px] leading-relaxed max-w-md">{PROJECT_TAGLINE}</p>

        <button onClick={onStart} className="btn-primary justify-center text-[15px] py-3.5 px-8 mt-2">
          Empezar <Icon name="arrow" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
