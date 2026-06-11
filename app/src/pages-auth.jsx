// ============================================================
// LoginPage — split branding / simulated auth form
// ============================================================
import React, { useState as useStateA } from "react";
import { PROJECT_TAGLINE } from "./constants.jsx";
import { mockAnalysisService } from "./mockService.jsx";
import { Icon, Wordmark, GradientOrbs } from "./components.jsx";

export function LoginPage({ navigate, onLogin }) {
  const [mode, setMode] = useStateA("login"); // "login" | "register"
  const [name, setName] = useStateA("");
  const [password, setPassword] = useStateA("");
  const [role, setRole] = useStateA("");
  const [errors, setErrors] = useStateA({});

  const isRegister = mode === "register";

  const submit = () => {
    const e = {};
    if (!name.trim()) e.name = "Ingresa tu nombre o correo.";
    if (!password.trim()) e.password = "Ingresa tu contraseña.";
    if (isRegister && !role) e.role = "Selecciona un tipo de usuario.";
    setErrors(e);
    if (Object.keys(e).length) return;
    // Simulated session — no backend validation.
    let finalRole = role;
    if (isRegister) {
      mockAnalysisService.registerUser({ name: name.trim(), role });
    } else {
      finalRole = mockAnalysisService.findUserRole(name) || "user";
    }
    onLogin({ name: name.trim(), role: finalRole });
    navigate(finalRole === "producer" ? "/producer" : "/user");
  };

  const floatingCards = [
    { label: "ML Score", value: "A · 92", icon: "sparkle", hue: 162, pos: "top-[11%] right-[7%]" },
    { label: "Release Prediction", value: "Vie 26 jul", icon: "calendar", hue: 178, pos: "top-[22%] right-[20%]" },
    { label: "Audience Potential", value: "250K plays", icon: "target", hue: 150, pos: "bottom-[9%] right-[8%]" },
  ];

  return (
    <div className="relative min-h-full grid lg:grid-cols-2">
      {/* ---------- LEFT: branding ---------- */}
      <div className="relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-14" style={{ background: "linear-gradient(160deg, oklch(0.2 0.04 162), oklch(0.16 0.03 270))" }}>
        <GradientOrbs />
        {/* floating cards (desktop only) */}
        <div className="hidden lg:block">
          {floatingCards.map((c) => (
            <div key={c.label} className={"absolute float-card " + c.pos}>
              <div className="card px-4 py-3 flex items-center gap-3" style={{ background: "oklch(0.22 0.03 190 / 0.7)", backdropFilter: "blur(10px)" }}>
                <span className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: `oklch(0.68 0.17 ${c.hue} / 0.18)`, color: `oklch(0.76 0.15 ${c.hue})` }}>
                  <Icon name={c.icon} className="w-4.5 h-4.5" />
                </span>
                <div className="leading-tight">
                  <div className="text-[11px] text-white/45 font-medium">{c.label}</div>
                  <div className="text-[15px] font-bold text-white font-display">{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <Wordmark size={40} />
        </div>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 text-[12px] font-semibold text-white/70 whitespace-nowrap" style={{ background: "oklch(1 0 0 / 0.06)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <Icon name="wave" className="w-4 h-4" /> Spotify · YouTube · Machine Learning
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.05]">
            Predice el <span style={{ color: "oklch(0.78 0.15 162)" }}>potencial</span> de tu música.
          </h1>
          <p className="text-white/55 mt-5 text-[16px] leading-relaxed">{PROJECT_TAGLINE}</p>
          <p className="text-white/40 mt-3 text-[14px] leading-relaxed">
            Analiza canciones, estima su potencial y recibe recomendaciones para mejorar su lanzamiento.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[12px] text-white/35">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.78 0.14 150)" }} /> Datos simulados</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.7 0.18 178)" }} /> Listo para ML real</span>
        </div>
      </div>

      {/* ---------- RIGHT: form ---------- */}
      <div className="flex items-center justify-center p-6 sm:p-12" style={{ background: "oklch(0.145 0.015 190)" }}>
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8"><Wordmark size={36} /></div>

          <div className="seg mb-7">
            <button className={"seg-btn " + (!isRegister ? "seg-btn--active" : "")} onClick={() => setMode("login")}>Iniciar sesión</button>
            <button className={"seg-btn " + (isRegister ? "seg-btn--active" : "")} onClick={() => setMode("register")}>Registrarse</button>
          </div>

          <h2 className="font-display text-2xl font-bold text-white">{isRegister ? "Crear una cuenta" : "Entrar a la plataforma"}</h2>
          <p className="text-white/45 text-sm mt-1.5 mb-8">
            {isRegister
              ? "Regístrate para comenzar a analizar canciones. (Demo · sin validación real)"
              : "Inicia sesión para comenzar a analizar canciones. (Demo · sin validación real)"}
          </p>

          <div className="flex flex-col gap-5">
            <Labeled label="Nombre o correo" error={errors.name}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="usuario@trackwise.ai" className="field" />
            </Labeled>
            <Labeled label="Contraseña" error={errors.password}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="field" />
            </Labeled>

            {isRegister && (
              <div>
                <div className="text-[13px] font-medium text-white/65 mb-2">Tipo de usuario</div>
                <div className="grid grid-cols-2 gap-3">
                  <RolePick active={role === "user"} onClick={() => setRole("user")} icon="analyze" title="Usuario normal" desc="Analiza desde YouTube" hue={162} />
                  <RolePick active={role === "producer"} onClick={() => setRole("producer")} icon="upload" title="Productor" desc="MP3 + YouTube" hue={178} />
                </div>
                {errors.role && <div className="text-[13px] mt-2" style={{ color: "oklch(0.72 0.18 25)" }}>{errors.role}</div>}
              </div>
            )}

            <button onClick={submit} className="btn-primary justify-center mt-1 text-[15px] py-3.5">
              {isRegister ? "Crear cuenta" : "Entrar a la plataforma"} <Icon name="arrow" className="w-4 h-4" />
            </button>
            <div className="text-center text-[12px] text-white/30">
              Sesión simulada guardada localmente · No se envían datos a ningún servidor.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, error, children }) {
  return (
    <label className="block">
      <div className="text-[13px] font-medium text-white/65 mb-2">{label}</div>
      {children}
      {error && <div className="text-[13px] mt-1.5" style={{ color: "oklch(0.72 0.18 25)" }}>{error}</div>}
    </label>
  );
}

function RolePick({ active, onClick, icon, title, desc, hue }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-3.5 transition-all"
      style={{
        background: active ? `oklch(0.66 0.18 ${hue} / 0.12)` : "oklch(0.2 0.02 190)",
        border: `1.5px solid ${active ? `oklch(0.7 0.17 ${hue} / 0.6)` : "oklch(1 0 0 / 0.07)"}`,
      }}
    >
      <span className="grid place-items-center w-9 h-9 rounded-lg mb-2.5" style={{ background: `oklch(0.66 0.18 ${hue} / 0.16)`, color: `oklch(0.76 0.15 ${hue})` }}>
        <Icon name={icon} className="w-4.5 h-4.5" />
      </span>
      <div className="font-semibold text-white text-[14px]">{title}</div>
      <div className="text-[12px] text-white/40 mt-0.5">{desc}</div>
    </button>
  );
}
