import type { NextFunction, Request, RequestHandler, Response } from "express";

interface UserRateLimitOptions {
    /** Довжина вікна, мс */
    windowMs: number;
    /** Скільки запитів дозволено юзеру за вікно */
    max: number;
}

interface HitCounter {
    count: number;
    resetAt: number;
}

/**
 * Простий rate limit на юзера (telegram id з authMiddleware; без нього — IP).
 * Фіксоване вікно, лічильники в пам'яті процесу: для одного інстансу бекенду
 * цього досить. Якщо інстансів буде кілька — перенести лічильники в Redis.
 * Підключати ПІСЛЯ authMiddleware.
 */
export const userRateLimit = ({ windowMs, max }: UserRateLimitOptions): RequestHandler => {
    const hits = new Map<string, HitCounter>();

    // Прибираємо прострочені лічильники, щоб Map не ріс безкінечно
    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        hits.forEach((counter, key) => {
            if (counter.resetAt <= now) hits.delete(key);
        });
    }, Math.min(windowMs, 10 * 60 * 1000));
    cleanupTimer.unref(); // таймер не тримає процес живим

    return (req: Request, res: Response, next: NextFunction): void => {
        const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip ?? "unknown"}`;
        const now = Date.now();
        const counter = hits.get(key);

        if (!counter || counter.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }

        if (counter.count >= max) {
            res.setHeader("Retry-After", String(Math.ceil((counter.resetAt - now) / 1000)));
            res.status(429).json({ error: "rate_limited" });
            return;
        }

        counter.count += 1;
        next();
    };
};

/**
 * Те саме обмеження, але для виклику всередині контролера (коли потрібен ключ,
 * відмінний від юзера, або маршрут не хочеться змінювати).
 * Повертає true, якщо дію дозволено (і рахує її), false — якщо ліміт вичерпано.
 */
export const createUserQuota = ({ windowMs, max }: UserRateLimitOptions): ((key: string) => boolean) => {
    const hits = new Map<string, HitCounter>();

    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        hits.forEach((counter, key) => {
            if (counter.resetAt <= now) hits.delete(key);
        });
    }, Math.min(windowMs, 10 * 60 * 1000));
    cleanupTimer.unref();

    return (key: string): boolean => {
        const now = Date.now();
        const counter = hits.get(key);
        if (!counter || counter.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return true;
        }
        if (counter.count >= max) return false;
        counter.count += 1;
        return true;
    };
};