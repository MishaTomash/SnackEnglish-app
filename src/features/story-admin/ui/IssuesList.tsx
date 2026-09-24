import type { FC } from "react";
import type { ContentIssue } from "../../../entities/story/adminTypes";

const MAX_VISIBLE = 60;

/** Помилки контенту, згруповані за уроками (якщо вставлено масив) */
export const IssuesList: FC<{ issues: ContentIssue[] }> = ({ issues }) => {
    if (issues.length === 0) return null;

    const groups = new Map<number | undefined, ContentIssue[]>();
    for (const issue of issues.slice(0, MAX_VISIBLE)) {
        const list = groups.get(issue.lesson) ?? [];
        list.push(issue);
        groups.set(issue.lesson, list);
    }

    return (
        <div
            role="alert"
            className="rounded-2xl border-2 border-[var(--accent-error)] bg-[var(--accent-error)]/10 p-4"
        >
            <p className="font-extrabold text-[var(--accent-error)]">
                Знайдено помилок: {issues.length}. Нічого не збережено.
            </p>
            <div className="mt-3 flex flex-col gap-3">
                {[...groups.entries()].map(([lesson, list]) => (
                    <div key={lesson ?? "root"}>
                        {lesson !== undefined && <p className="mb-1 text-sm font-bold">Урок {lesson}</p>}
                        <ul className="flex flex-col gap-1.5">
                            {list.map((issue, i) => (
                                <li key={i} className="text-sm leading-snug">
                                    <code className="rounded bg-[var(--bg-app)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent-cta)]">
                                        {issue.path}
                                    </code>{" "}
                                    <span>{issue.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {issues.length > MAX_VISIBLE && (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                    …і ще {issues.length - MAX_VISIBLE}. Виправте перші — решта часто зникає разом із ними.
                </p>
            )}
        </div>
    );
};