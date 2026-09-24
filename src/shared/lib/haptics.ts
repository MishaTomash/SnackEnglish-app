/**
 * Тактильний відгук через Telegram WebApp.HapticFeedback.
 * Поза Telegram або на старих клієнтах — тихий no-op.
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

interface HapticFeedbackLike {
    impactOccurred?: (style: ImpactStyle) => void;
    notificationOccurred?: (type: NotificationType) => void;
    selectionChanged?: () => void;
}

const getHaptics = (): HapticFeedbackLike | undefined => {
    if (typeof window === "undefined") return undefined;
    return (
        window as unknown as {
            Telegram?: { WebApp?: { HapticFeedback?: HapticFeedbackLike } };
        }
    ).Telegram?.WebApp?.HapticFeedback;
};

const safely = (fn: () => void) => {
    try {
        fn();
    } catch {
        // Старі версії WebApp кидають на непідтримуваних методах — ігноруємо
    }
};

export const hapticImpact = (style: ImpactStyle = "medium"): void =>
    safely(() => getHaptics()?.impactOccurred?.(style));

export const hapticNotify = (type: NotificationType): void =>
    safely(() => getHaptics()?.notificationOccurred?.(type));

export const hapticSelection = (): void =>
    safely(() => getHaptics()?.selectionChanged?.());