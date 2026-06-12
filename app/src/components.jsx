// ============================================================
// Reusable UI components (atoms + molecules)
// ============================================================
import React, { useState, useEffect } from "react";
import { PROJECT_NAME, RATING_HUE, RATING_TEXT } from "./constants.jsx";

// ---- Icons (simple inline strokes) -----------------------------------
export function Icon({ name, className = "w-5 h-5", stroke = 1.7 }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  const P = {
    analyze: <path d="M4 14l4-4 3 3 5-6 4 5" />,
    history: (
      <>
        <path d="M3 12a9 9 0 109-9 9 9 0 00-6.5 2.8L3 8" />
        <path d="M3 4v4h4" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    logout: (
      <>
        <path d="M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3" />
        <path d="M10 17l-5-5 5-5" />
        <path d="M5 12h12" />
      </>
    ),
    youtube: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
        <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
      </>
    ),
    sparkle: (
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7" />
        <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    wave: <path d="M3 12h2l2-6 3 13 3-18 3 14 2-3h3" />,
    file: (
      <>
        <path d="M6 2.5h8l4 4V21a1 1 0 01-1 1H6a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
        <path d="M14 2.5V7h4" />
      </>
    ),
    check: <path d="M5 12l5 5L20 6" />,
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </>
    ),
    bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
    metronome: (
      <>
        <path d="M12 21V3M6 21h12" />
        <path d="M8 9l4-6 4 6" />
      </>
    ),
  };
  return <svg {...common}>{P[name] || null}</svg>;
}

// ---- Brand logo mark (simple equalizer bars) -------------------------
export function Logo({ size = 36 }) {
  return (
    <div
      className="relative grid place-items-center rounded-xl shrink-0"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, oklch(0.66 0.2 162), oklch(0.64 0.18 178))",
        boxShadow: "0 8px 22px -8px oklch(0.6 0.2 162 / 0.7)",
      }}
    >
      <div className="flex items-end gap-[2px]" style={{ height: size * 0.42 }}>
        {[0.5, 1, 0.7, 0.32].map((h, i) => (
          <span
            key={i}
            className="block rounded-full bg-white"
            style={{ width: Math.max(2, size * 0.07), height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Wordmark({ size = 36, sub }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <div className="leading-tight">
        <div className="font-display font-bold tracking-tight text-white whitespace-nowrap" style={{ fontSize: size * 0.5 }}>
          {PROJECT_NAME}
        </div>
        {sub && <div className="text-[11px] text-white/40 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

// ---- Decorative gradient orbs (login background) ---------------------
export function GradientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orb" style={{ background: "oklch(0.6 0.2 162)", top: "-12%", left: "-6%", width: 460, height: 460 }} />
      <div className="orb" style={{ background: "oklch(0.62 0.18 178)", bottom: "-18%", right: "-4%", width: 520, height: 520 }} />
      <div className="orb" style={{ background: "oklch(0.7 0.16 150)", top: "38%", left: "44%", width: 300, height: 300, opacity: 0.25 }} />
    </div>
  );
}

// ---- Source chip (YouTube / MP3) -------------------------------------
export function SourceChip({ source, className = "" }) {
  const yt = source === "youtube";
  return (
    <span
      className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold " + className}
      style={{
        color: yt ? "oklch(0.72 0.2 25)" : "oklch(0.78 0.14 150)",
        background: yt ? "oklch(0.72 0.2 25 / 0.12)" : "oklch(0.78 0.14 150 / 0.12)",
        border: `1px solid ${yt ? "oklch(0.72 0.2 25 / 0.25)" : "oklch(0.78 0.14 150 / 0.25)"}`,
      }}
    >
      <Icon name={yt ? "youtube" : "file"} className="w-3.5 h-3.5" />
      {yt ? "YouTube" : "MP3"}
    </span>
  );
}

// ---- RatingBadge -----------------------------------------------------
export function RatingBadge({ rating, score, size = "lg" }) {
  const hue = RATING_HUE[rating] ?? 150;
  const ring = `oklch(0.72 0.17 ${hue})`;
  const big = size === "lg";
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid place-items-center rounded-2xl font-display font-bold"
        style={{
          width: big ? 96 : 60,
          height: big ? 96 : 60,
          fontSize: big ? 52 : 30,
          color: ring,
          background: `oklch(0.72 0.17 ${hue} / 0.12)`,
          border: `1.5px solid oklch(0.72 0.17 ${hue} / 0.4)`,
          boxShadow: `0 0 40px -12px oklch(0.72 0.17 ${hue} / 0.6)`,
        }}
      >
        {rating}
      </div>
      {big && (
        <div>
          <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-0.5">Rating ML</div>
          <div className="text-lg font-semibold text-white">{RATING_TEXT[rating]}</div>
          {typeof score === "number" && (
            <div className="text-sm text-white/45 mt-0.5">Score predictivo: <span className="text-white/80 font-semibold">{score}/100</span></div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Generic surface card --------------------------------------------
export function Card({ className = "", children, style }) {
  return (
    <div className={"card " + className} style={style}>
      {children}
    </div>
  );
}

// ---- FeatureCard -----------------------------------------------------
export function FeatureCard({ feature, accent = 162, icon = "chart" }) {
  return (
    <Card className="p-5 hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-white/50 font-medium">{feature.name}</div>
        <span
          className="grid place-items-center w-8 h-8 rounded-lg shrink-0"
          style={{ background: `oklch(0.66 0.18 ${accent} / 0.14)`, color: `oklch(0.74 0.16 ${accent})` }}
        >
          <Icon name={icon} className="w-4 h-4" />
        </span>
      </div>
      <div className="font-display text-2xl font-bold text-white mt-2 mb-3">{feature.value}</div>
      <div className="flex gap-2 text-[13px] text-white/55 leading-relaxed">
        <Icon name="bolt" className="w-4 h-4 mt-0.5 shrink-0 text-white/30" />
        <span>{feature.recommendation}</span>
      </div>
    </Card>
  );
}

// ---- RecommendationCard ----------------------------------------------
export function RecommendationCard({ rec, index }) {
  return (
    <Card className="p-5 flex gap-4 items-start hover:border-white/15 transition-colors">
      <div
        className="grid place-items-center w-10 h-10 rounded-xl font-display font-bold text-white shrink-0"
        style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 162), oklch(0.6 0.18 178))" }}
      >
        {index + 1}
      </div>
      <div>
        <div className="font-semibold text-white mb-1">{rec.title}</div>
        <div className="text-[13px] text-white/55 leading-relaxed">{rec.description}</div>
      </div>
    </Card>
  );
}

// ---- InfoBlock (the little 3-up explainer tiles) ---------------------
export function InfoBlock({ icon, title, text, accent = 162 }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className="grid place-items-center w-10 h-10 rounded-xl"
        style={{ background: `oklch(0.66 0.18 ${accent} / 0.14)`, color: `oklch(0.74 0.16 ${accent})` }}
      >
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div className="font-semibold text-white text-[15px]">{title}</div>
      <div className="text-[13px] text-white/50 leading-relaxed">{text}</div>
    </div>
  );
}

// ---- LoadingAnalysis (full overlay) ----------------------------------
export function LoadingAnalysis({ label = "Analizando canción…" }) {
  const steps = ["Detectando señales del video", "Simulando datos musicales", "Generando predicción"];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 380);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: "oklch(0.14 0.02 190 / 0.82)", backdropFilter: "blur(8px)" }}>
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "oklch(0.7 0.18 162)", borderRightColor: "oklch(0.66 0.18 178)" }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-end gap-1 h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="eqbar w-1.5 rounded-full bg-white" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="font-display text-xl font-bold text-white">{label}</div>
          <div className="text-sm text-white/55 mt-1 transition-all">{steps[active]}…</div>
        </div>
      </div>
    </div>
  );
}

// ---- EmptyState ------------------------------------------------------
export function EmptyState({ icon = "history", title, text, actionLabel, onAction }) {
  return (
    <Card className="p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto">
      <span className="grid place-items-center w-16 h-16 rounded-2xl text-white/40" style={{ background: "oklch(0.66 0.16 162 / 0.1)" }}>
        <Icon name={icon} className="w-7 h-7" />
      </span>
      <div>
        <div className="font-display text-xl font-bold text-white mb-1.5">{title}</div>
        <div className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">{text}</div>
      </div>
      {actionLabel && (
        <button onClick={onAction} className="btn-primary mt-1">
          <Icon name="plus" className="w-4 h-4" /> {actionLabel}
        </button>
      )}
    </Card>
  );
}
