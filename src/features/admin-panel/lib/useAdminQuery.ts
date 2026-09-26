// 📁 Файл: SnackEnglish-app/src/features/admin-panel/lib/useAdminQuery.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api";

interface AdminQueryState<T> {
    data: T | null;
    error: string | null;
    isLoading: boolean;
    /** Перезавантажити (після дії адміна) */
    reload: () => void;
}

/**
 * Завантаження даних для вкладки адмінки. Нова відповідь не затирається старою,
 * якщо параметри змінились, поки йшов попередній запит.
 */
export const useAdminQuery = <T,>(load: () => Promise<T>, deps: readonly unknown[]): AdminQueryState<T> => {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        let alive = true;
        setIsLoading(true);
        setError(null);
        loadRef
            .current()
            .then((result) => {
                if (alive) setData(result);
            })
            .catch((loadError: unknown) => {
                if (alive) setError(getErrorMessage(loadError));
            })
            .finally(() => {
                if (alive) setIsLoading(false);
            });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- залежності передає вкладка
    }, [...deps, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);

    return { data, error, isLoading, reload };
};