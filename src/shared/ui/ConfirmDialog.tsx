import { useEffect } from "react";
import type { FC, ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    children?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Червона кнопка підтвердження — для незворотних дій */
    danger?: boolean;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Модальне підтвердження дії. Esc і клік по фону — скасування */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
    open,
    title,
    children,
    confirmLabel = "Підтвердити",
    cancelLabel = "Скасувати",
    danger = false,
    isLoading = false,
    onConfirm,
    onCancel,
}) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isLoading) onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, isLoading, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => !isLoading && onCancel()}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-sm rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl"
            >
                <h2 className="text-xl font-extrabold">{title}</h2>
                {children && <div className="mt-2 text-sm text-[var(--text-muted)]">{children}</div>}
                <div className="mt-6 flex flex-col gap-2">
                    <Button
                        variant={danger ? "danger" : "primary"}
                        size="lg"
                        isLoading={isLoading}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                    <Button variant="ghost" disabled={isLoading} onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};