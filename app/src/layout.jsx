// ============================================================
// Layout shell + form input components
// ============================================================
const { useState: useStateL, useRef: useRefL, useEffect: useEffectL } = React;

// ---- Sidebar ---------------------------------------------------------
function Sidebar({ role, route, navigate, onLogout, mobileOpen, setMobileOpen }) {
  // Producer & user share the same menu; only the first label differs.
  const items = [
    { key: role === "producer" ? "producer" : "user", label: role === "producer" ? "Analizar producción" : "Analizar canción", icon: "analyze" },
    { key: "history", label: "Historial", icon: "history" },
  ];
  const go = (k) => { navigate("/" + k); setMobileOpen(false); };

  return (
    <>
      {/* mobile scrim */}
      <div
        className={"fixed inset-0 z-30 bg-black/60 lg:hidden transition-opacity " + (mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={
          "fixed lg:static z-40 h-full w-[270px] shrink-0 flex flex-col gap-2 p-5 transition-transform lg:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
        style={{ background: "oklch(0.17 0.018 190)", borderRight: "1px solid oklch(1 0 0 / 0.06)" }}
      >
        <div className="px-1 py-2 mb-2">
          <Wordmark size={34} sub={role === "producer" ? "Panel productor" : "Panel usuario"} />
        </div>

        <nav className="flex flex-col gap-1.5">
          {items.map((it) => {
            const activeNav = route === "/" + it.key || (it.key !== "history" && route === "/results");
            return (
              <button
                key={it.key}
                onClick={() => go(it.key)}
                className={"nav-item " + (route === "/" + it.key ? "nav-item--active" : "")}
              >
                <Icon name={it.icon} className="w-[18px] h-[18px]" />
                {it.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="rounded-xl p-3.5" style={{ background: "oklch(0.2 0.02 190)", border: "1px solid oklch(1 0 0 / 0.05)" }}>
            <div className="text-[11px] uppercase tracking-wider text-white/35 font-semibold mb-1">Simulación</div>
            <div className="text-[12px] text-white/45 leading-snug">Spotify / YouTube Data Simulation · Modelo ML mock</div>
          </div>
          <button onClick={onLogout} className="nav-item text-white/55 hover:text-white">
            <Icon name="logout" className="w-[18px] h-[18px]" /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

// ---- Navbar (top bar inside content) ---------------------------------
function Navbar({ session, onMenu, navigate }) {
  const initials = (session?.name || "U").trim().slice(0, 2).toUpperCase();
  return (
    <header className="flex items-center justify-between gap-4 mb-1">
      <button onClick={onMenu} className="lg:hidden grid place-items-center w-10 h-10 rounded-xl text-white/70" style={{ background: "oklch(0.2 0.02 190)" }}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <div className="lg:hidden flex-1"><Wordmark size={28} /></div>
      <div className="hidden lg:block flex-1" />
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/history")} className="hidden sm:inline-flex btn-ghost">
          <Icon name="history" className="w-4 h-4" /> Historial
        </button>
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right hidden sm:block leading-tight">
            <div className="text-[13px] font-semibold text-white whitespace-nowrap">{session?.name}</div>
            <div className="text-[11px] text-white/40 capitalize">{session?.role === "producer" ? "Productor" : "Usuario"}</div>
          </div>
          <div className="grid place-items-center w-10 h-10 rounded-full font-semibold text-white text-sm" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 162), oklch(0.6 0.18 178))" }}>
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}

// ---- AppLayout (sidebar + scrollable content) ------------------------
function AppLayout({ session, route, navigate, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useStateL(false);
  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar role={session.role} route={route} navigate={navigate} onLogout={onLogout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-6 sm:py-8 flex flex-col gap-7">
          <Navbar session={session} onMenu={() => setMobileOpen(true)} navigate={navigate} />
          {children}
        </div>
      </main>
    </div>
  );
}

// ---- Page header (title + subtitle) ----------------------------------
function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-6 flex-wrap">
      <div className="max-w-2xl">
        <h1 className="font-display text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-white/50 mt-2 leading-relaxed text-[15px]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ---- YouTubeInput ----------------------------------------------------
// `large` => roomy, stacked paste area (used on the Producer panel).
function YouTubeInput({ value, onChange, onSubmit, placeholder, buttonLabel = "Analizar canción", error, large = false }) {
  if (large) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="rounded-2xl p-2.5 flex flex-col gap-2.5 transition-colors"
          style={{ background: "oklch(0.2 0.02 190 / 0.5)", border: "1.5px solid oklch(1 0 0 / 0.1)" }}
        >
          <div className="relative flex-1">
            <span className="absolute left-4 top-5 text-white/35"><Icon name="youtube" className="w-5 h-5" /></span>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              placeholder={placeholder}
              rows={3}
              className="field pl-12 pt-4 resize-none leading-relaxed"
              style={{ minHeight: 96, background: "transparent", border: "none", boxShadow: "none" }}
            />
          </div>
          <button onClick={onSubmit} className="btn-primary justify-center w-full whitespace-nowrap text-[15px] py-3.5">
            <Icon name="sparkle" className="w-4 h-4" /> {buttonLabel}
          </button>
        </div>
        {error && <div className="text-[13px] flex items-center gap-1.5" style={{ color: "oklch(0.72 0.18 25)" }}><Icon name="bolt" className="w-3.5 h-3.5" /> {error}</div>}
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"><Icon name="youtube" className="w-5 h-5" /></span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder={placeholder}
            className="field pl-12"
          />
        </div>
        <button onClick={onSubmit} className="btn-primary sm:w-auto justify-center whitespace-nowrap">
          <Icon name="sparkle" className="w-4 h-4" /> {buttonLabel}
        </button>
      </div>
      {error && <div className="text-[13px] mt-2 flex items-center gap-1.5" style={{ color: "oklch(0.72 0.18 25)" }}><Icon name="bolt" className="w-3.5 h-3.5" /> {error}</div>}
    </div>
  );
}

// ---- FileUploadDropzone ----------------------------------------------
function FileUploadDropzone({ file, setFile, error, setError }) {
  const inputRef = useRefL(null);
  const [drag, setDrag] = useStateL(false);

  const handle = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".mp3")) {
      setError("Solo se permiten archivos .mp3");
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className="dropzone"
        style={{
          borderColor: drag ? "oklch(0.7 0.18 162)" : file ? "oklch(0.74 0.14 150 / 0.5)" : "oklch(1 0 0 / 0.12)",
          background: drag ? "oklch(0.66 0.18 162 / 0.08)" : "oklch(0.2 0.02 190 / 0.4)",
        }}
      >
        <input ref={inputRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={(e) => handle(e.target.files[0])} />
        {file ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid place-items-center w-12 h-12 rounded-xl" style={{ background: "oklch(0.74 0.14 150 / 0.15)", color: "oklch(0.78 0.14 150)" }}><Icon name="check" className="w-6 h-6" /></span>
            <div className="font-semibold text-white text-sm">{file.name}</div>
            <div className="text-[12px] text-white/40">Archivo listo · haz clic para cambiar</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid place-items-center w-12 h-12 rounded-xl text-white/45" style={{ background: "oklch(0.66 0.18 162 / 0.12)" }}><Icon name="upload" className="w-6 h-6" /></span>
            <div className="font-semibold text-white text-[15px]">Arrastra tu archivo MP3 aquí</div>
            <div className="text-[13px] text-white/45 max-w-xs">También puedes hacer clic para seleccionar un archivo desde tu computadora.</div>
          </div>
        )}
      </div>
      {error && <div className="text-[13px] mt-2 flex items-center gap-1.5" style={{ color: "oklch(0.72 0.18 25)" }}><Icon name="bolt" className="w-3.5 h-3.5" /> {error}</div>}
    </div>
  );
}

Object.assign(window, { Sidebar, Navbar, AppLayout, PageHeader, YouTubeInput, FileUploadDropzone });
