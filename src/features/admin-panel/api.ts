// 📁 Файл: SnackEnglish-app/src/features/admin-panel/api.ts
import axios from "axios";
import { apiClient } from "../../shared/api/apiClient";

/**
 * API адмін-панелі (/api/admin/*). Усі запити — з авторизацією Telegram через apiClient;
 * сервер пускає лише VITE_ADMIN_ID.
 */

// ==================== ТИПИ ====================

export interface DailyPoint {
    date: string;
    value: number;
}

export interface DashboardData {
    generatedAt: string;
    periodDays: number;
    users: {
        total: number;
        newToday: number;
        new7: number;
        new30: number;
        activeToday: number;
        active7: number;
        active30: number;
        onboarded: number;
        blocked: number;
    };
    series: { newUsers: DailyPoint[]; activeUsers: DailyPoint[]; lessonsCompleted: DailyPoint[] };
    levels: { level: string; count: number }[];
    streaks: { average: number; max: number; weekPlus: number; monthPlus: number };
    retention: { cohortSize: number; returned: number; rate: number };
    revenue: {
        starsTotal: number;
        starsPurchases: number;
        manualApproved: number;
        manualPending: number;
        byGame: { gameId: string; title: string; stars: number; manual: number }[];
    };
    week: { totalScore: number; players: number; top: { telegramId: number; name: string; score: number }[] };
    topEvents: { eventType: string; count: number }[];
}

export interface AdminUser {
    _id: string;
    telegramId: number;
    username?: string | null;
    telegramFirstName?: string | null;
    customDisplayName?: string | null;
    customAvatarUrl?: string | null;
    telegramPhotoUrl?: string | null;
    level?: string | null;
    streak?: number;
    hp?: number;
    weeklyScore?: number;
    totalScore?: number;
    blocked?: boolean;
    onboardingCompleted?: boolean;
    lastActivityDate?: string | null;
    createdAt?: string;
}

export interface UsersPage {
    users: AdminUser[];
    total: number;
    page: number;
    pages: number;
}

export interface UsersQuery {
    search?: string;
    status?: "all" | "active" | "blocked";
    level?: string;
    onboarding?: "" | "done" | "pending";
    sort?: "createdAt" | "lastActivityDate" | "weeklyScore" | "totalScore" | "streak";
    order?: "asc" | "desc";
    page?: number;
}

export interface UserDetail {
    user: AdminUser;
    stats: { lessonsCompleted: number; friendsCount: number; likesReceived: number; weeklyRank: number };
    purchases: { gameId: string; title: string; purchasedAt: string | null; method: "stars" | "manual" }[];
    payments: { id: string; gameTitle: string; uniqueCode: string; status: string; createdAt: string | null }[];
    events: { id: string; eventType: string; metadata: unknown; createdAt: string | null }[];
}

export interface UserUpdate {
    blocked?: boolean;
    level?: string | null;
    hp?: number;
    streak?: number;
    scoreDelta?: number;
}

export interface AdminGame {
    gameId: string;
    title: string;
    isFree?: boolean;
    priceStars?: number;
}

export type AudienceType = "all" | "active7" | "inactive7" | "no_onboarding" | "level";

export interface BroadcastForm {
    text: string;
    photo: File | null;
    buttonText: string;
    buttonUrl: string;
    buttonOpenApp: boolean;
    audienceType: AudienceType;
    level: string;
}

export interface BroadcastProgress {
    running: boolean;
    kind: "text" | "photo" | "copy" | null;
    audience: string | null;
    total: number;
    sent: number;
    failed: number;
    startedAt: string | null;
    finishedAt: string | null;
    status: "idle" | "running" | "completed" | "cancelled" | "failed";
    error: string | null;
}

export interface BroadcastLogEntry {
    _id: string;
    kind: "text" | "photo" | "copy";
    textPreview: string;
    audience: string;
    buttonText: string | null;
    total: number;
    sent: number;
    failed: number;
    status: "completed" | "cancelled" | "failed";
    error: string | null;
    startedAt: string;
    finishedAt: string;
}

export interface PaymentRow {
    id: string;
    telegramId: number;
    userName: string;
    gameId: string;
    gameTitle: string;
    uniqueCode: string;
    status: "pending" | "approved" | "rejected";
    hasReceipt: boolean;
    createdAt: string | null;
}

export interface PaymentsPage {
    payments: PaymentRow[];
    total: number;
    pendingCount: number;
    page: number;
    pages: number;
}

export interface PurchaseRow {
    id: string;
    telegramId: number;
    userName: string;
    gameTitle: string;
    stars: number;
    purchasedAt: string | null;
}

export interface LeaderboardEntry {
    _id: string;
    nickname: string;
    score: number;
    position: number;
}

export interface GiveawayWeek {
    _id: string;
    weekNumber: number;
    endDate: string;
    winners: { userId: string; nickname: string; score: number; position: number }[];
}

export interface ContentNode {
    id: string;
    order: number;
    label: string;
    icon: string | null;
    isBoss: boolean;
    started: number;
    completed: number;
}

export interface ContentChapter {
    id: string;
    title: string;
    level: string;
    order: number;
    published: boolean;
    nodes: ContentNode[];
    startedUsers: number;
    finishedUsers: number;
}

export interface SystemStatus {
    uptimeSec: number;
    nodeVersion: string;
    memoryMb: { rss: number; heapUsed: number };
    mongo: string;
    timezone: string;
    serverTime: string;
    speechMode: "server" | "browser" | "off";
    nextGiveawayAt: string;
    broadcast: BroadcastProgress;
    cron: { time: string; title: string; sendsMessages: boolean }[];
    config: { key: string; ok: boolean; level: "error" | "warning"; hint: string }[];
}

export interface AppSettings {
    paymentsEnabled: boolean;
    dailyLessonLimit: number;
    dailyGoalLessons: number;
    dailyGoalBonus: number;
    supportEnabled: boolean;
    supportUrl: string;
    supportTitle: string;
    supportText: string;
    supportGiveawayText: string;
    referralBonus: number;
    botWelcomeImage: string;
    ttsEnabled: boolean;
    ttsModel: string;
    ttsVoice: string;
    ttsVoiceSnacky: string;
    ttsVoiceUser: string;
    ttsVoiceNpc: string;
    ttsSpeed: number;
    ttsInstructions: string;
    ttsAutoGenerate: boolean;
    ttsMonthlyLimitUsd: number;
    ttsPlaybackRate: number;
}

export interface TtsSettings {
    ttsEnabled: boolean;
    ttsModel: string;
    ttsVoice: string;
    ttsVoiceSnacky: string;
    ttsVoiceUser: string;
    ttsVoiceNpc: string;
    ttsSpeed: number;
    ttsInstructions: string;
    ttsAutoGenerate: boolean;
    ttsMonthlyLimitUsd: number;
    ttsPlaybackRate: number;
}

export interface TtsJob {
    running: boolean;
    scope: string | null;
    total: number;
    done: number;
    failed: number;
    spentUsd: number;
    status: "idle" | "running" | "completed" | "cancelled" | "failed" | "limit_reached";
    error: string | null;
}

export interface TtsNodeSummary {
    id: string;
    order: number;
    label: string;
    total: number;
    ready: number;
}

export interface TtsChapter {
    id: string;
    title: string;
    level: string;
    total: number;
    ready: number;
    missingCostUsd: number;
    nodes: TtsNodeSummary[];
}

export interface TtsOverview {
    configured: boolean;
    settings: TtsSettings;
    options: { models: string[]; voices: string[]; miniOnlyVoices: string[] };
    totals: {
        phrases: number;
        ready: number;
        missingChars: number;
        totalChars: number;
        missingCostUsd: number;
        monthSpendUsd: number;
        allTimeCostUsd: number;
        storedClips: number;
        storedMb: number;
    };
    chapters: TtsChapter[];
    job: TtsJob;
}

export type SpeechRole = "narrator" | "snacky" | "user" | "npc";

export interface TtsPhrase {
    key: string;
    text: string;
    role: SpeechRole;
    /** Емоція репліки (для інтонації) */
    style?: string;
    url: string | null;
}

export interface SettingsResponse {
    settings: AppSettings;
    stats: { supportClicks7: number; supportClicks30: number; limitHits7: number; goalsReached7: number };
}

// ==================== ПОМИЛКИ ====================

/** Текст помилки з відповіді сервера — адмінка показує його як є */
export const getErrorMessage = (error: unknown, fallback = "Щось пішло не так"): string => {
    if (axios.isAxiosError(error)) {
        const data: unknown = error.response?.data;
        if (typeof data === "object" && data !== null && "error" in data) {
            const message = (data as { error: unknown }).error;
            if (typeof message === "string" && message) return message;
        }
        if (!error.response) return "Немає зв'язку з сервером";
        if (error.response.status === 403) return "Доступ лише для адміна";
    }
    return fallback;
};

// ==================== ЗАПИТИ ====================

const toBroadcastFormData = (form: BroadcastForm): FormData => {
    const data = new FormData();
    data.append("text", form.text);
    data.append("audienceType", form.audienceType);
    if (form.audienceType === "level") data.append("level", form.level);
    if (form.buttonText.trim()) {
        data.append("buttonText", form.buttonText.trim());
        data.append("buttonUrl", form.buttonUrl.trim());
        data.append("buttonOpenApp", String(form.buttonOpenApp));
    }
    if (form.photo) data.append("photo", form.photo);
    return data;
};

export const adminApi = {
    dashboard: (days: number, fresh = false) =>
        apiClient.get<DashboardData>("/admin/dashboard", { params: { days, fresh: fresh ? "1" : undefined } }).then((r) => r.data),

    users: (query: UsersQuery) =>
        apiClient
            .get<UsersPage>("/admin/users", {
                params: {
                    search: query.search || undefined,
                    status: query.status && query.status !== "all" ? query.status : undefined,
                    level: query.level || undefined,
                    onboarding: query.onboarding || undefined,
                    sort: query.sort,
                    order: query.order,
                    page: query.page,
                },
            })
            .then((r) => r.data),
    userDetail: (telegramId: number) => apiClient.get<UserDetail>(`/admin/users/${telegramId}`).then((r) => r.data),
    updateUser: (telegramId: number, update: UserUpdate) =>
        apiClient.patch<{ user: AdminUser }>(`/admin/users/${telegramId}`, update).then((r) => r.data.user),
    messageUser: (telegramId: number, text: string) =>
        apiClient.post(`/admin/users/${telegramId}/message`, { text }).then(() => undefined),
    setUserGame: (telegramId: number, gameId: string, grant: boolean) =>
        apiClient.post(`/admin/users/${telegramId}/games`, { gameId, grant }).then(() => undefined),
    exportUsers: () => apiClient.post<{ count: number }>("/admin/users/export", undefined, { timeout: 60000 }).then((r) => r.data),
    games: () => apiClient.get<AdminGame[]>("/admin/games").then((r) => r.data),

    broadcastEstimate: (audienceType: AudienceType, level: string) =>
        apiClient
            .post<{ count: number }>("/admin/broadcast/estimate", { audienceType, level: audienceType === "level" ? level : undefined })
            .then((r) => r.data.count),
    broadcastTest: (form: BroadcastForm) =>
        apiClient.post("/admin/broadcast/test", toBroadcastFormData(form), { timeout: 30000 }).then(() => undefined),
    broadcastStart: (form: BroadcastForm) =>
        apiClient
            .post<{ count: number }>("/admin/broadcast/start", toBroadcastFormData(form), { timeout: 30000 })
            .then((r) => r.data.count),
    broadcastStatus: () => apiClient.get<BroadcastProgress>("/admin/broadcast/status").then((r) => r.data),
    broadcastCancel: () => apiClient.post("/admin/broadcast/cancel").then(() => undefined),
    broadcastHistory: () => apiClient.get<BroadcastLogEntry[]>("/admin/broadcast/history").then((r) => r.data),

    payments: (status: string, page: number) =>
        apiClient.get<PaymentsPage>("/admin/payments", { params: { status, page } }).then((r) => r.data),
    /** Квитанція як Blob: <img> не вміє слати заголовок авторизації */
    receipt: (id: string) =>
        apiClient.get<Blob>(`/admin/payments/${id}/receipt`, { responseType: "blob", timeout: 30000 }).then((r) => r.data),
    resolvePayment: (id: string, action: "approve" | "reject") =>
        apiClient.post(`/admin/payments/${id}/resolve`, { action }).then(() => undefined),
    purchases: () => apiClient.get<PurchaseRow[]>("/admin/purchases").then((r) => r.data),

    // Розіграш — наявні ендпоінти рейтингу
    leaderboard: () =>
        apiClient.get<{ top?: LeaderboardEntry[] }>("/user/leaderboard").then((r) => r.data.top ?? []),
    giveawayHistory: () => apiClient.get<GiveawayWeek[]>("/user/giveaway-history").then((r) => r.data),
    endGiveaway: () => apiClient.post("/user/giveaway/force-end").then(() => undefined),

    content: (fresh = false) =>
        apiClient
            .get<{ chapters: ContentChapter[]; generatedAt: string }>("/admin/content", { params: { fresh: fresh ? "1" : undefined } })
            .then((r) => r.data),

    ttsOverview: () => apiClient.get<TtsOverview>("/admin/tts/overview", { timeout: 30000 }).then((r) => r.data),
    ttsNode: (nodeId: string) => apiClient.get<{ phrases: TtsPhrase[] }>(`/admin/tts/nodes/${nodeId}`).then((r) => r.data.phrases),
    ttsGenerate: (scope: "all" | "chapter" | "node", id?: string) =>
        apiClient.post<{ total: number }>("/admin/tts/generate", { scope, id }, { timeout: 30000 }).then((r) => r.data.total),
    ttsJob: () => apiClient.get<TtsJob>("/admin/tts/job").then((r) => r.data),
    ttsCancel: () => apiClient.post("/admin/tts/job/cancel").then(() => undefined),
    ttsRegenerate: (text: string, role: SpeechRole, style?: string) =>
        apiClient.post<{ url: string }>("/admin/tts/regenerate", { text, role, style }, { timeout: 40000 }).then((r) => r.data.url),
    /** Зразок голосу — mp3 як Blob (не зберігається) */
    ttsPreview: (payload: { text: string; model: string; voice: string; speed: number; instructions: string }) =>
        apiClient.post<Blob>("/admin/tts/preview", payload, { responseType: "blob", timeout: 40000 }).then((r) => r.data),
    ttsCleanup: () => apiClient.post<{ removed: number; freedMb: number }>("/admin/tts/cleanup", undefined, { timeout: 60000 }).then((r) => r.data),

    settings: () => apiClient.get<SettingsResponse>("/admin/settings").then((r) => r.data),
    updateSettings: (patch: Partial<AppSettings>) =>
        apiClient.patch<{ settings: AppSettings }>("/admin/settings", patch).then((r) => r.data.settings),

    system: () => apiClient.get<SystemStatus>("/admin/system").then((r) => r.data),
    clearCache: () => apiClient.post("/admin/system/clear-cache").then(() => undefined),
};