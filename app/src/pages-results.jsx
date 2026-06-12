// ============================================================
// ResultsPage — ML output from the database
// ============================================================
import React from "react";
import { RATING_HUE, RATING_TEXT } from "./constants.jsx";
import { mockAnalysisService } from "./mockService.jsx";
import { Icon, Card, SourceChip, FeatureCard, EmptyState } from "./components.jsx";
import { PageHeader } from "./layout.jsx";

// Format large integers: 1250000 → "1.25M", 45000 → "45K", 800 → "800"
function formatCount(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return n.toLocaleString("es-ES");
}

// Format a/b as percentage, returns "—" when either value is missing or zero denominator
function formatPct(num, den, decimals = 2) {
  if (num == null || den == null || den === 0) return "—";
  return ((num / den) * 100).toFixed(decimals) + "%";
}

// Map a feature name to the best icon (supports key/tempo from the audio model)
function featureIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("key") || n.includes("clave") || n.includes("tonal")) return "music";
  if (n.includes("tempo") || n.includes("bpm")) return "wave";
  return "chart";
}

// Map a feature name to a good accent hue (musical features get distinct colours)
function featureAccent(name = "", fallback = 162) {
  const n = name.toLowerCase();
  if (n.includes("key") || n.includes("clave") || n.includes("tonal")) return 150;
  if (n.includes("tempo") || n.includes("bpm")) return 178;
  return fallback;
}

export function ResultsPage({ navigate, session }) {
  const result = mockAnalysisService.getCurrentAnalysis();

  if (!result) {
    return (
      <>
        <PageHeader title="Resultado del análisis" subtitle="Aún no hay un análisis activo para mostrar." />
        <EmptyState
          icon="chart"
          title="No hay ningún análisis todavía"
          text="Analiza una canción desde YouTube o sube un MP3 para ver aquí su predicción."
          actionLabel="Volver a analizar"
          onAction={() => navigate(session.role === "producer" ? "/producer" : "/user")}
        />
      </>
    );
  }

  const dateLabel = new Date(result.createdAt).toLocaleString("es-ES", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const hue = RATING_HUE[result.rating] ?? 150;

  const ev = result.expectedViews;
  const el = result.expectedLikes;
  const ec = result.expectedComments;
  const hasEngagement = true; // siempre visible; withDummyFiller garantiza valores

  return (
    <>
      <PageHeader
        title="Resultado del análisis"
        subtitle="Predicción generada a partir de señales musicales, métricas de audiencia y datos de rendimiento."
      />

      {/* ===== HERO: Rating ML ===== */}
      <Card className="relative overflow-hidden p-6 sm:p-9"
        style={{ background: `linear-gradient(135deg, oklch(0.74 0.17 ${hue} / 0.14), oklch(0.2 0.02 190))`, borderColor: `oklch(0.74 0.17 ${hue} / 0.3)` }}>
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, oklch(0.74 0.17 ${hue} / 0.28), transparent 70%)` }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-7">
          {/* giant rating letter */}
          <div className="grid place-items-center rounded-3xl font-display font-bold shrink-0 mx-auto sm:mx-0"
            style={{
              width: 168, height: 168, fontSize: 104,
              color: `oklch(0.8 0.16 ${hue})`,
              background: `oklch(0.74 0.17 ${hue} / 0.14)`,
              border: `2px solid oklch(0.74 0.17 ${hue} / 0.45)`,
              boxShadow: `0 0 70px -18px oklch(0.74 0.17 ${hue} / 0.8)`,
            }}>
            {result.rating}
          </div>

          {/* verdict + score */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 justify-center sm:justify-start">
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold whitespace-nowrap" style={{ color: `oklch(0.8 0.14 ${hue})` }}>Rating ML</span>
              <SourceChip source={result.source} />
            </div>
            <div className="font-display text-3xl sm:text-[40px] font-bold text-white tracking-tight leading-tight text-center sm:text-left">
              {RATING_TEXT[result.rating]}
            </div>

            <div className="mt-5 max-w-xl mx-auto sm:mx-0">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[13px] font-medium text-white/55">Score predictivo</span>
                <span className="font-display text-2xl font-bold text-white">{result.score}<span className="text-white/35 text-base">/100</span></span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "oklch(0.26 0.02 190)" }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: result.score + "%",
                  background: `linear-gradient(90deg, oklch(0.66 0.18 162), oklch(0.7 0.17 ${hue}))`,
                }} />
              </div>
              <div className="flex justify-between text-[11px] text-white/30 mt-1.5">
                {["F", "E", "D", "C", "B", "A"].map((l) => <span key={l} className={l === result.rating ? "text-white font-bold" : ""}>{l}</span>)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* source meta strip */}
      <div className="flex flex-wrap items-center gap-2 -mt-2 text-[13px]">
        <Icon name={result.source === "youtube" ? "youtube" : "file"} className="w-4 h-4 text-white/30" />
        <span className="text-white/55">{result.inputName}</span>
        <span className="text-white/30">· analizado el {dateLabel}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT column (2/3): summary + engagement + recs */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* summary */}
          <Card className="p-6 sm:p-7">
            <h3 className="font-display text-lg font-bold text-white mb-2.5">Resumen general</h3>
            <p className="text-[14.5px] text-white/60 leading-relaxed">{result.summary}</p>
          </Card>

          {/* YouTube engagement prediction */}
          {hasEngagement && (
            <Card className="p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="youtube" className="w-5 h-5" style={{ color: "oklch(0.72 0.2 25)" }} />
                <h3 className="font-display text-lg font-bold text-white">Predicción de engagement en YouTube</h3>
              </div>

              {/* Main counts */}
              <div className="grid grid-cols-3 gap-5 mb-6">
                {[
                  { label: "Vistas esperadas",       value: formatCount(ev), icon: "eye",   h: 162 },
                  { label: "Likes esperados",         value: formatCount(el), icon: "check", h: 150 },
                  { label: "Comentarios esperados",   value: formatCount(ec), icon: "wave",  h: 178 },
                ].map(({ label, value, icon, h }) => (
                  <div key={label} className="flex flex-col gap-2">
                    <span className="grid place-items-center w-8 h-8 rounded-lg"
                      style={{ background: `oklch(0.66 0.18 ${h} / 0.14)`, color: `oklch(0.74 0.16 ${h})` }}>
                      <Icon name={icon} className="w-4 h-4" />
                    </span>
                    <div className="font-display text-2xl font-bold text-white">{value}</div>
                    <div className="text-[12px] text-white/45">{label}</div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/8 mb-5" />

              {/* Derived metrics */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Tasa de likes",
                    value: formatPct(el, ev),
                    sub: "likes / vistas",
                  },
                  {
                    label: "Tasa de comentarios",
                    value: formatPct(ec, ev, 3),
                    sub: "comentarios / vistas",
                  },
                  {
                    label: "Comentarios por like",
                    value: (ec != null && el != null && el > 0) ? (ec / el).toFixed(2) : "—",
                    sub: "comentarios / likes",
                  },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <div className="font-display text-xl font-bold text-white">{value}</div>
                    <div className="text-[12.5px] text-white/60 font-medium">{label}</div>
                    <div className="text-[11px] text-white/30">{sub}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* RIGHT column (1/3): features (key, tempo + any others) */}
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-bold text-white">Features relevantes</h3>
          {result.features.map((f, i) => (
            <FeatureCard
              key={i}
              feature={f}
              icon={featureIcon(f.name)}
              accent={featureAccent(f.name, [162, 25, 150, 178][i % 4])}
            />
          ))}
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-3 pt-2 pb-4">
        <button onClick={() => navigate(session.role === "producer" ? "/producer" : "/user")} className="btn-primary">
          <Icon name="plus" className="w-4 h-4" /> Nuevo análisis
        </button>
        <button onClick={() => navigate("/history")} className="btn-ghost">
          <Icon name="history" className="w-4 h-4" /> Ver historial
        </button>
      </div>
    </>
  );
}
