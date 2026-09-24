import { useUserStore } from "../../../store/userStore";

// Той самий ID, що перевіряє бекенд (middleware adminOnly: VITE_ADMIN_ID).
// Це лише показ/приховування UI — справжній захист на сервері.
const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_ID ?? 0);

export const useIsAdmin = (): boolean =>
    useUserStore((state) => ADMIN_ID > 0 && state.telegramId === ADMIN_ID);