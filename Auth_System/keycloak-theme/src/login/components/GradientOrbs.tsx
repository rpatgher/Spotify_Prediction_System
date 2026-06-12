// Decorative gradient orbs (login background) — ported from app/src/components.jsx
export function GradientOrbs() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="orb" style={{ background: "oklch(0.6 0.2 162)", top: "-12%", left: "-6%", width: 460, height: 460 }} />
            <div className="orb" style={{ background: "oklch(0.62 0.18 178)", bottom: "-18%", right: "-4%", width: 520, height: 520 }} />
            <div className="orb" style={{ background: "oklch(0.7 0.16 150)", top: "38%", left: "44%", width: 300, height: 300, opacity: 0.25 }} />
        </div>
    );
}
