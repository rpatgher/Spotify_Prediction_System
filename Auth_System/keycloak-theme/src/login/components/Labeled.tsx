// Labeled form field wrapper — ported from app/src/pages-auth.jsx
export function Labeled({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <div className="text-[13px] font-medium text-white/65 mb-2">{label}</div>
            {children}
            {error && (
                <div className="text-[13px] mt-1.5" style={{ color: "oklch(0.72 0.18 25)" }} aria-live="polite" dangerouslySetInnerHTML={{ __html: error }} />
            )}
        </label>
    );
}
