// User-type picker card — ported from app/src/pages-auth.jsx
import { Icon, type IconName } from "./Icon";

export function RolePick(props: { active: boolean; onClick: () => void; icon: IconName; title: string; desc: string; hue: number }) {
    const { active, onClick, icon, title, desc, hue } = props;
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-left rounded-xl p-3.5 transition-all"
            style={{
                background: active ? `oklch(0.66 0.18 ${hue} / 0.12)` : "oklch(0.2 0.02 190)",
                border: `1.5px solid ${active ? `oklch(0.7 0.17 ${hue} / 0.6)` : "oklch(1 0 0 / 0.07)"}`
            }}
        >
            <span
                className="grid place-items-center w-9 h-9 rounded-lg mb-2.5"
                style={{ background: `oklch(0.66 0.18 ${hue} / 0.16)`, color: `oklch(0.76 0.15 ${hue})` }}
            >
                <Icon name={icon} className="w-4.5 h-4.5" />
            </span>
            <div className="font-semibold text-white text-[14px]">{title}</div>
            <div className="text-[12px] text-white/40 mt-0.5">{desc}</div>
        </button>
    );
}
