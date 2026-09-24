import { useEffect } from "react";
import type { FC, ReactNode } from "react";

export interface AdminSheetProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Кнопки дій — прикріплені внизу */
    footer?: ReactNode;
}

/** Повноекранний модальний лист адмінки (над BottomNav). Esc — закрити */
export const AdminSheet: FC<AdminSheetProps> = ({ title, onClose, children, footer }) => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        // Прокрутка сторінки під листом блокується, поки він відкритий
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
        };
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[65] flex flex-col bg-[var(--bg-app)] text-[var(--text-main)]"
        >
            <header className="flex items-center gap-3 border-b border-[var(--border-color)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрити"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                >
                    ✕
                </button>
                <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h2>
            </header>
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">{children}</div>
            </div>
            {footer && (
                <footer className="border-t border-[var(--border-color)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                    <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-end gap-2">{footer}</div>
                </footer>
            )}
        </div>
    );
};