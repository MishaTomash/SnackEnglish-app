// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/PaymentsTab.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { Check, ChevronLeft, ChevronRight, Receipt, X } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import type { PaymentRow } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    EmptyState,
    ErrorState,
    LoadingState,
    Notice,
    Pill,
    Section,
    Segmented,
    formatDateTime,
    formatNumber,
} from "./primitives";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS: Record<PaymentRow["status"], { label: string; tone: "warning" | "success" | "error" }> = {
    pending: { label: "чекає", tone: "warning" },
    approved: { label: "підтверджено", tone: "success" },
    rejected: { label: "відхилено", tone: "error" },
};

/** Квитанція: сервер віддає файл з Telegram (посилання Telegram містить токен бота) */
const ReceiptViewer: FC<{ paymentId: string; onClose: () => void }> = ({ paymentId, onClose }) => {
    const [state, setState] = useState<{ url: string; type: string } | { error: string } | null>(null);

    useEffect(() => {
        let url: string | null = null;
        let alive = true;
        adminApi
            .receipt(paymentId)
            .then((blob) => {
                if (!alive) return;
                url = URL.createObjectURL(blob);
                setState({ url, type: blob.type });
            })
            .catch((error: unknown) => alive && setState({ error: getErrorMessage(error) }));
        return () => {
            alive = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [paymentId]);

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Квитанція">
            <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрити" />
            <div className="relative max-h-full w-full max-w-lg overflow-auto rounded-2xl bg-[var(--bg-card)] p-3">
                <div className="mb-2 flex justify-end">
                    <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--text-muted)]" aria-label="Закрити">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {!state ? (
                    <LoadingState />
                ) : "error" in state ? (
                    <ErrorState message={state.error} />
                ) : state.type.startsWith("image/") ? (
                    <img src={state.url} alt="Квитанція" className="w-full rounded-xl" />
                ) : (
                    <div className="space-y-2 text-center">
                        <p className="text-sm text-[var(--text-muted)]">PDF-квитанція. Якщо не відкривається тут — вона є в чаті з ботом.</p>
                        <object data={state.url} type={state.type} className="h-[70vh] w-full rounded-xl" aria-label="PDF-квитанція" />
                    </div>
                )}
            </div>
        </div>
    );
};

export const PaymentsTab: FC = () => {
    const [status, setStatus] = useState<StatusFilter>("pending");
    const [page, setPage] = useState(1);
    const [receiptId, setReceiptId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const payments = useAdminQuery(() => adminApi.payments(status, page), [status, page]);
    const purchases = useAdminQuery(() => adminApi.purchases(), []);

    const resolve = async (payment: PaymentRow, action: "approve" | "reject") => {
        const question =
            action === "approve"
                ? `Підтвердити оплату «${payment.gameTitle}» від ${payment.userName}? Гра відкриється.`
                : `Відхилити оплату від ${payment.userName}?`;
        if (!window.confirm(question)) return;

        setBusyId(payment.id);
        setNotice(null);
        try {
            await adminApi.resolvePayment(payment.id, action);
            setNotice({ kind: "success", text: action === "approve" ? "Оплату підтверджено, юзеру надіслано повідомлення" : "Оплату відхилено" });
            payments.reload();
        } catch (error) {
            setNotice({ kind: "error", text: getErrorMessage(error) });
        } finally {
            setBusyId(null);
        }
    };

    const data = payments.data;

    return (
        <div className="space-y-4">
            <Section title={data ? `Ручні оплати · чекають: ${data.pendingCount}` : "Ручні оплати"}>
                <div className="mb-3">
                    <Segmented<StatusFilter>
                        value={status}
                        onChange={(value) => {
                            setStatus(value);
                            setPage(1);
                        }}
                        options={[
                            { value: "pending", label: "Чекають" },
                            { value: "approved", label: "Підтверджені" },
                            { value: "rejected", label: "Відхилені" },
                            { value: "all", label: "Усі" },
                        ]}
                    />
                </div>
                {notice && <div className="mb-3"><Notice kind={notice.kind}>{notice.text}</Notice></div>}

                {payments.isLoading && !data ? (
                    <LoadingState />
                ) : payments.error ? (
                    <ErrorState message={payments.error} onRetry={payments.reload} />
                ) : !data || data.payments.length === 0 ? (
                    <EmptyState>{status === "pending" ? "Нових оплат немає 🎉" : "Нічого немає"}</EmptyState>
                ) : (
                    <ul className="space-y-2">
                        {data.payments.map((p) => (
                            <li key={p.id} className="rounded-2xl bg-[var(--bg-app)] p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-[var(--text-main)]">{p.gameTitle}</p>
                                        <p className="truncate text-xs text-[var(--text-muted)]">
                                            {p.userName} · код <span className="font-mono">{p.uniqueCode}</span>
                                        </p>
                                        <p className="text-[11px] text-[var(--text-muted)]">{formatDateTime(p.createdAt)}</p>
                                    </div>
                                    <Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {p.hasReceipt ? (
                                        <AdminButton variant="secondary" onClick={() => setReceiptId(p.id)}>
                                            <Receipt className="h-4 w-4" aria-hidden="true" /> Квитанція
                                        </AdminButton>
                                    ) : (
                                        <span className="self-center text-[11px] text-[var(--text-muted)]">Квитанцію ще не надіслано</span>
                                    )}
                                    {p.status === "pending" && (
                                        <>
                                            <AdminButton variant="success" loading={busyId === p.id} onClick={() => void resolve(p, "approve")}>
                                                <Check className="h-4 w-4" aria-hidden="true" /> Підтвердити
                                            </AdminButton>
                                            <AdminButton variant="danger" disabled={busyId === p.id} onClick={() => void resolve(p, "reject")}>
                                                <X className="h-4 w-4" aria-hidden="true" /> Відхилити
                                            </AdminButton>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {data && data.pages > 1 && (
                    <div className="mt-3 flex items-center justify-between">
                        <AdminButton variant="secondary" disabled={page <= 1} onClick={() => setPage((v) => v - 1)} className="px-3">
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Попередня сторінка</span>
                        </AdminButton>
                        <span className="text-xs text-[var(--text-muted)]">
                            {data.page} / {data.pages}
                        </span>
                        <AdminButton variant="secondary" disabled={page >= data.pages} onClick={() => setPage((v) => v + 1)} className="px-3">
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Наступна сторінка</span>
                        </AdminButton>
                    </div>
                )}
            </Section>

            <Section title="Покупки за Зірки ⭐">
                {purchases.isLoading && !purchases.data ? (
                    <LoadingState />
                ) : purchases.error ? (
                    <ErrorState message={purchases.error} onRetry={purchases.reload} />
                ) : !purchases.data || purchases.data.length === 0 ? (
                    <EmptyState>Покупок за Зірки ще немає</EmptyState>
                ) : (
                    <ul className="divide-y divide-[var(--border-color)]">
                        {purchases.data.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-[var(--text-main)]">{p.gameTitle}</p>
                                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                                        {p.userName} · {formatDateTime(p.purchasedAt)}
                                    </p>
                                </div>
                                <span className="shrink-0 font-black text-[var(--accent-cta)]">⭐ {formatNumber(p.stars)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {receiptId && <ReceiptViewer paymentId={receiptId} onClose={() => setReceiptId(null)} />}
        </div>
    );
};