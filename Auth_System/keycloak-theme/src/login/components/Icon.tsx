// Inline stroke icons — subset ported from app/src/components.jsx (only the
// ones used on the login page).
export type IconName = "sparkle" | "calendar" | "target" | "wave" | "arrow" | "analyze" | "upload";

export function Icon({ name, className = "w-5 h-5", stroke = 1.7 }: { name: IconName; className?: string; stroke?: number }) {
    const common = {
        className,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: stroke,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const
    };
    const P: Record<IconName, React.ReactNode> = {
        sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
        calendar: (
            <>
                <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
                <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </>
        ),
        target: (
            <>
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3.5" />
            </>
        ),
        wave: <path d="M3 12h2l2-6 3 13 3-18 3 14 2-3h3" />,
        analyze: <path d="M4 14l4-4 3 3 5-6 4 5" />,
        upload: (
            <>
                <path d="M12 16V4" />
                <path d="M7 9l5-5 5 5" />
                <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </>
        ),
        arrow: <path d="M5 12h14M13 6l6 6-6 6" />
    };
    return <svg {...common}>{P[name] ?? null}</svg>;
}
