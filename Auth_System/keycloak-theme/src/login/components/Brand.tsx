// Brand logo + wordmark — ported from app/src/components.jsx
const PROJECT_NAME = "TrackVision AI";

export function Logo({ size = 36 }: { size?: number }) {
    return (
        <div
            className="relative grid place-items-center rounded-xl shrink-0"
            style={{
                width: size,
                height: size,
                background: "linear-gradient(135deg, oklch(0.66 0.2 162), oklch(0.64 0.18 178))",
                boxShadow: "0 8px 22px -8px oklch(0.6 0.2 162 / 0.7)"
            }}
        >
            <div className="flex items-end gap-[2px]" style={{ height: size * 0.42 }}>
                {[0.5, 1, 0.7, 0.32].map((h, i) => (
                    <span key={i} className="block rounded-full bg-white" style={{ width: Math.max(2, size * 0.07), height: `${h * 100}%` }} />
                ))}
            </div>
        </div>
    );
}

export function Wordmark({ size = 36, sub }: { size?: number; sub?: string }) {
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
