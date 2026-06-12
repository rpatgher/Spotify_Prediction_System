// Shared split branding/form shell for login + register pages — ported from
// app/src/pages-auth.jsx. The segmented control links between the Keycloak
// login and registration URLs.
import { Icon, type IconName } from "./Icon";
import { Wordmark } from "./Brand";
import { GradientOrbs } from "./GradientOrbs";

const PROJECT_TAGLINE = "Predicción musical basada en datos de Spotify, YouTube y Machine Learning.";

const floatingCards: { label: string; value: string; icon: IconName; hue: number; pos: string }[] = [
    { label: "ML Score", value: "A · 92", icon: "sparkle", hue: 162, pos: "top-[11%] right-[7%]" },
    { label: "Release Prediction", value: "Vie 26 jul", icon: "calendar", hue: 178, pos: "top-[22%] right-[20%]" },
    { label: "Audience Potential", value: "250K plays", icon: "target", hue: 150, pos: "bottom-[9%] right-[8%]" }
];

export function AuthLayout(props: {
    mode: "login" | "register";
    loginUrl: string;
    registrationUrl?: string;
    children: React.ReactNode;
}) {
    const { mode, loginUrl, registrationUrl, children } = props;
    const isRegister = mode === "register";

    return (
        <div className="relative min-h-screen grid lg:grid-cols-2">
            {/* ---------- LEFT: branding ---------- */}
            <div
                className="relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-14"
                style={{ background: "linear-gradient(160deg, oklch(0.2 0.04 162), oklch(0.16 0.03 270))" }}
            >
                <GradientOrbs />
                {/* floating cards (desktop only) */}
                <div className="hidden lg:block">
                    {floatingCards.map(c => (
                        <div key={c.label} className={"absolute float-card " + c.pos}>
                            <div
                                className="card px-4 py-3 flex items-center gap-3"
                                style={{ background: "oklch(0.22 0.03 190 / 0.7)", backdropFilter: "blur(10px)" }}
                            >
                                <span
                                    className="grid place-items-center w-9 h-9 rounded-lg"
                                    style={{ background: `oklch(0.68 0.17 ${c.hue} / 0.18)`, color: `oklch(0.76 0.15 ${c.hue})` }}
                                >
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
                    <div
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 text-[12px] font-semibold text-white/70 whitespace-nowrap"
                        style={{ background: "oklch(1 0 0 / 0.06)", border: "1px solid oklch(1 0 0 / 0.08)" }}
                    >
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

                <div className="relative z-10" />
            </div>

            {/* ---------- RIGHT: form ---------- */}
            <div className="flex items-center justify-center p-6 sm:p-12" style={{ background: "oklch(0.145 0.015 190)" }}>
                <div className="w-full max-w-[400px]">
                    <div className="lg:hidden mb-8">
                        <Wordmark size={36} />
                    </div>

                    <div className="seg mb-7">
                        <a className={"seg-btn " + (!isRegister ? "seg-btn--active" : "")} href={loginUrl}>
                            Iniciar sesión
                        </a>
                        {(registrationUrl !== undefined || isRegister) && (
                            <a className={"seg-btn " + (isRegister ? "seg-btn--active" : "")} href={registrationUrl ?? "#"}>
                                Registrarse
                            </a>
                        )}
                    </div>

                    <h2 className="font-display text-2xl font-bold text-white">{isRegister ? "Crear una cuenta" : "Entrar a la plataforma"}</h2>
                    <p className="text-white/45 text-sm mt-1.5 mb-8">
                        {isRegister ? "Regístrate para comenzar a analizar canciones." : "Inicia sesión para comenzar a analizar canciones."}
                    </p>

                    {children}
                </div>
            </div>
        </div>
    );
}
