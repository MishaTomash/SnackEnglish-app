import { useEffect, useMemo, useState } from "react";
import { speak, stopSpeaking } from "../../../shared/lib/speech";
import { shuffle } from "../../../shared/lib/shuffle";
import { RichText } from "../../../shared/ui/RichText";
import { WordChip } from "../../../shared/ui/WordChip";
import { StepFeedback } from "../StepFeedback";
import { asText, toWords } from "../lib/sanitize";
import { useStepCheck } from "../lib/useStepCheck";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";

interface Token {
    id: number; // позиція в пулі: однакові слова ("the", "the") розрізняються за id
    word: string;
}

const sameWordOrder = (a: readonly Token[], b: readonly Token[]) =>
    a.length === b.length && a.every((token, i) => token.word === b[i].word);

/**
 * Шафл, після якого слова гарантовано не стоять у вихідному порядку
 * (інакше відповідь уже складена). Для 2 слів шанс "невдалого" шафлу — 50%,
 * тому не повторюємо навмання, а зсуваємо на одну позицію.
 */
const shuffleTokens = (tokens: readonly Token[]): Token[] => {
    const result = shuffle(tokens);
    if (tokens.length > 1 && sameWordOrder(result, tokens)) {
        const rotated = [...result.slice(1), result[0]];
        // Якщо й після зсуву порядок той самий — усі слова однакові, і це вже не важливо
        return rotated;
    }
    return result;
};

/**
 * Конструктор речення: слова з банку викладаються в рядок відповіді (клік по
 * викладеному повертає його назад). Перевірка — точний збіг послідовності слів.
 * Кожна нова спроба перемішує банк заново (Fisher–Yates).
 */
export const BuildStep: StepComponent<"build"> = ({ step, onNext, onLoseLife }) => {
    const answer = useMemo(() => toWords(step.answer), [step.answer]);
    const pool = useMemo<Token[]>(
        () => [...answer, ...toWords(step.distractors)].map((word, id) => ({ id, word })),
        [answer, step.distractors],
    );
    const [bank, setBank] = useState<Token[]>(() => shuffleTokens(pool));
    const [placed, setPlaced] = useState<number[]>([]); // id токенів у порядку викладання
    const check = useStepCheck(onNext, onLoseLife);

    useEffect(() => () => stopSpeaking(), []);

    const placedSet = new Set(placed);
    const byId = new Map(pool.map((token) => [token.id, token]));

    const place = (id: number) => {
        if (!check.isAnswering || placedSet.has(id)) return;
        setPlaced((prev) => [...prev, id]);
    };

    const unplace = (id: number) => {
        if (!check.isAnswering) return;
        setPlaced((prev) => prev.filter((placedId) => placedId !== id));
    };

    const handleCta = () => {
        if (check.phase === "correct") return check.complete();
        if (check.phase === "wrong") {
            setBank(shuffleTokens(pool));
            setPlaced([]);
            return check.retry();
        }
        if (answer.length === 0) return check.complete(); // битий крок не блокує урок

        const built = placed.map((id) => byId.get(id)?.word ?? "");
        const isCorrect =
            built.length === answer.length && built.every((word, i) => word === answer[i]);

        if (isCorrect) {
            check.resolve("correct");
            void speak(answer.join(" "));
        } else {
            check.resolve("wrong");
        }
    };

    const ctaLabel =
        check.phase === "correct" ? "Далі" : check.phase === "wrong" ? "Спробувати ще" : "Перевірити";

    return (
        <div className="flex flex-1 flex-col">
            <p className="pb-2 text-center text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Склади речення
            </p>
            {step.prompt && (
                <p className="pb-5 text-center text-xl font-bold text-[var(--text-main)]">
                    <RichText text={asText(step.prompt)} />
                </p>
            )}

            {/* Рядок відповіді */}
            <div
                aria-label="Твоя відповідь"
                className={`flex min-h-16 flex-wrap content-start gap-2 border-b-2 pb-3 ${check.phase === "correct"
                        ? "border-[var(--accent-success)]"
                        : check.phase === "wrong"
                            ? "border-[var(--accent-error)]"
                            : "border-[var(--border-color)]"
                    }`}
            >
                {placed.map((id) => (
                    <WordChip
                        key={id}
                        word={byId.get(id)?.word ?? ""}
                        variant="placed"
                        disabled={!check.isAnswering}
                        onClick={() => unplace(id)}
                    />
                ))}
            </div>

            {/* Банк слів: взяті лишаються "тінню", щоб решта не стрибала */}
            <div aria-label="Слова" className="flex flex-wrap justify-center gap-2 pt-6">
                {bank.map((token) => (
                    <WordChip
                        key={token.id}
                        word={token.word}
                        variant={placedSet.has(token.id) ? "used" : "available"}
                        disabled={!check.isAnswering}
                        onClick={() => place(token.id)}
                    />
                ))}
            </div>

            {check.phase === "correct" && (
                <StepFeedback kind="correct" detail={<>«{answer.join(" ")}»</>} />
            )}
            {check.phase === "wrong" && <StepFeedback kind="wrong" />}

            <StepCta
                label={ctaLabel}
                disabled={check.isAnswering && placed.length === 0 && answer.length > 0}
                onClick={handleCta}
            />
        </div>
    );
};