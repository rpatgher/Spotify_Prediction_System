// ============================================================
// ResultsPage — simulated ML output
// ============================================================
function ResultsPage({ navigate, session }) {
  const result = mockAnalysisService.getCurrentAnalysis();

  if (!result) {
    return (
      <>
        <PageHeader title="Resultado del análisis" subtitle="Aún no hay un análisis activo para mostrar." />
        <EmptyState
          icon="chart"
          title="No hay ningún análisis todavía"
          text="Analiza una canción desde YouTube o sube un MP3 para ver aquí su predicción simulada."
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

  return (
    <>
      <PageHeader
        title="Resultado del análisis"
        subtitle="Predicción simulada generada a partir de señales musicales, métricas de audiencia y datos de rendimiento."
      />

      {/* ===== HERO: Rating ML (elemento principal) ===== */}
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
        {/* LEFT column (2/3): release date + summary + recs */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* best release date */}
          <Card className="p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full" style={{ background: "radial-gradient(circle, oklch(0.66 0.18 178 / 0.18), transparent 70%)" }} />
            <div className="relative flex items-start gap-2 mb-1">
              <Icon name="calendar" className="w-5 h-5 mt-0.5" style={{ color: "oklch(0.74 0.16 178)" }} />
              <h3 className="font-display text-lg font-bold text-white">Mejor fecha sugerida para lanzar la canción</h3>
            </div>
            <div className="relative font-display text-3xl sm:text-4xl font-bold mt-3 mb-3 tracking-tight" style={{ color: "oklch(0.82 0.12 178)" }}>
              {result.bestReleaseDate}
            </div>
            <p className="relative text-[13.5px] text-white/50 leading-relaxed max-w-2xl">{RELEASE_DATE_NOTE}</p>
          </Card>

          {/* summary */}
          <Card className="p-6 sm:p-7">
            <h3 className="font-display text-lg font-bold text-white mb-2.5">Resumen general</h3>
            <p className="text-[14.5px] text-white/60 leading-relaxed">{result.summary}</p>
          </Card>

          {/* recommendations */}
          <div>
            <h3 className="font-display text-lg font-bold text-white mb-3">Recomendaciones principales</h3>
            <div className="flex flex-col gap-3">
              {result.recommendations.map((r, i) => <RecommendationCard key={i} rec={r} index={i} />)}
            </div>
          </div>
        </div>

        {/* RIGHT column (1/3): features */}
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-bold text-white">Features relevantes</h3>
          {result.features.map((f, i) => <FeatureCard key={i} feature={f} accent={[162, 25, 150][i % 3]} />)}
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

Object.assign(window, { ResultsPage });
