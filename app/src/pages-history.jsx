// ============================================================
// HistoryPage — list of saved analyses with filter + sort
// ============================================================
const { useState: useStateH } = React;

const RATING_ORDER = { A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

// ---- HistoryItem -----------------------------------------------------
function HistoryItem({ item, onView, onDelete }) {
  const hue = RATING_HUE[item.rating] ?? 150;
  const dateLabel = new Date(item.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return (
    <Card className="p-4 sm:p-5 flex items-center gap-4 hover:border-white/15 transition-colors">
      {/* rating square */}
      <div className="grid place-items-center w-14 h-14 rounded-xl font-display font-bold text-2xl shrink-0"
        style={{ color: `oklch(0.74 0.17 ${hue})`, background: `oklch(0.74 0.17 ${hue} / 0.12)`, border: `1px solid oklch(0.74 0.17 ${hue} / 0.3)` }}>
        {item.rating}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-semibold text-white truncate">{item.inputName}</span>
          <SourceChip source={item.source} />
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12.5px] text-white/45 mt-1.5">
          <span>{dateLabel}</span>
          <span className="flex items-center gap-1"><Icon name="chart" className="w-3.5 h-3.5 text-white/30" /> Score {item.score}/100</span>
          <span className="flex items-center gap-1"><Icon name="calendar" className="w-3.5 h-3.5 text-white/30" /> {item.bestReleaseDate}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onView(item)} className="btn-ghost text-[13px] px-3 py-2 whitespace-nowrap">
          <Icon name="eye" className="w-4 h-4" /> <span className="hidden sm:inline">Ver resultado</span>
        </button>
        <button onClick={() => onDelete(item.id)} className="icon-btn" title="Eliminar">
          <Icon name="trash" className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

function HistoryPage({ navigate, session }) {
  const [list, setList] = useStateH(mockAnalysisService.getHistory());
  const [filter, setFilter] = useStateH("all"); // all | youtube | mp3
  const [sort, setSort] = useStateH("recent"); // recent | rating

  const view = (item) => {
    mockAnalysisService.setCurrentAnalysis(item);
    navigate("/results");
  };
  const remove = (id) => {
    mockAnalysisService.deleteFromHistory(id);
    setList(mockAnalysisService.getHistory());
  };

  let shown = list.filter((r) => filter === "all" || r.source === filter);
  shown = [...shown].sort((a, b) =>
    sort === "rating"
      ? RATING_ORDER[b.rating] - RATING_ORDER[a.rating] || b.score - a.score
      : new Date(b.createdAt) - new Date(a.createdAt)
  );

  const filters = [
    { key: "all", label: "Todos" },
    { key: "youtube", label: "YouTube" },
    { key: "mp3", label: "MP3" },
  ];

  return (
    <>
      <PageHeader
        title="Historial de análisis"
        subtitle="Consulta las canciones, links o archivos que analizaste anteriormente."
      />

      {list.length === 0 ? (
        <EmptyState
          icon="history"
          title="Aún no tienes análisis guardados"
          text="Cuando analices una canción, aparecerá aquí con su rating, fecha sugerida y recomendaciones principales."
          actionLabel="Crear primer análisis"
          onAction={() => navigate(session.role === "producer" ? "/producer" : "/user")}
        />
      ) : (
        <>
          {/* controls */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="seg">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={"seg-btn " + (filter === f.key ? "seg-btn--active" : "")}>{f.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-white/40">Ordenar:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-select">
                <option value="recent">Más recientes primero</option>
                <option value="rating">Mejor rating primero</option>
              </select>
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="text-center text-white/40 text-sm py-10">No hay análisis de este tipo.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {shown.map((item) => <HistoryItem key={item.id} item={item} onView={view} onDelete={remove} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

Object.assign(window, { HistoryPage, HistoryItem });
