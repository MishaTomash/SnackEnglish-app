// 📁 Файл: SnackEnglish-app/src/features/story-admin/ui/visual/StepForm.tsx
import type { FC, ReactNode } from "react";
import type {
    ChoiceOption,
    DialogueLine,
    DialogueSpeaker,
    FlashCardItem,
    ReplyOption,
    ReplyQuality,
    StepPayload,
} from "../../../../entities/story/types";
import {
    AddButton,
    EmojiField,
    ItemControls,
    RichTextField,
    SelectField,
    TextField,
    inputClass,
    moveItem,
    removeItem,
    replaceItem,
} from "./fields";

/**
 * Форма кроку уроку — окрема для кожного з 10 типів.
 * Замість JSON: зрозумілі поля, списки з кнопками, вибір правильної відповіді кліком.
 */

const EMOTIONS = [
    { value: "", label: "— як зазвичай —" },
    { value: "happy", label: "😊 радісний" },
    { value: "excited", label: "🤩 у захваті" },
    { value: "celebrating", label: "🎉 святкує" },
    { value: "thinking", label: "🤔 думає" },
    { value: "surprised", label: "😮 здивований" },
    { value: "scared", label: "😱 наляканий" },
    { value: "sad", label: "😢 сумний" },
    { value: "sleeping", label: "😴 спить" },
    { value: "idle", label: "😐 спокійний" },
] as const;

const SPEAKERS: readonly { value: DialogueSpeaker; label: string }[] = [
    { value: "snacky", label: "🍪 Снекі" },
    { value: "user", label: "🙋 Юзер" },
    { value: "npc", label: "🧑 Персонаж уроку" },
];

const QUALITIES: readonly { value: ReplyQuality; label: string }[] = [
    { value: "good", label: "✅ Добра" },
    { value: "ok", label: "🟡 Так собі" },
    { value: "bad", label: "❌ Погана" },
];

const EFFECTS = [
    { value: "", label: "без ефекту" },
    { value: "flash", label: "⚡ спалах" },
    { value: "shake", label: "📳 трясіння" },
    { value: "rain", label: "🌧️ дощ" },
] as const;

/** Правильна відповідь як індекс (у старих уроках могла бути текстом) */
const correctIndex = (correct: number | string, options: readonly string[]): number => {
    if (typeof correct === "number") return correct;
    const target = correct.trim().toLowerCase();
    return options.findIndex((o) => o.trim().toLowerCase() === target);
};

/** Список варіантів з вибором правильного (тест, аудіювання) */
const OptionsWithCorrect: FC<{
    options: string[];
    correct: number | string;
    onChange: (options: string[], correct: number) => void;
    english: boolean;
}> = ({ options, correct, onChange, english }) => {
    const current = correctIndex(correct, options);

    // Після переміщення/видалення "правильна" позначка лишається на тому самому варіанті
    const move = (from: number, to: number) => {
        const next = moveItem(options, from, to);
        const nextCorrect = current === from ? to : current === to ? from : current;
        onChange(next, nextCorrect);
    };
    const remove = (index: number) => {
        const nextCorrect = current === index ? -1 : current > index ? current - 1 : current;
        onChange(removeItem(options, index), nextCorrect);
    };

    return (
        <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-muted)]">
                Варіанти <span className="font-normal">— натисни ○, щоб позначити правильний</span>
            </p>
            {options.map((option, i) => {
                const isCorrect = i === current;
                return (
                    <div
                        key={i}
                        className={`flex items-center gap-1.5 rounded-xl border p-1.5 ${isCorrect ? "border-[var(--accent-success)] bg-[var(--accent-success)]/10" : "border-[var(--border-color)]"
                            }`}
                    >
                        <button
                            type="button"
                            onClick={() => onChange(options, i)}
                            aria-pressed={isCorrect}
                            aria-label={`Варіант ${i + 1} правильний`}
                            title="Правильна відповідь"
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold ${isCorrect
                                    ? "border-[var(--accent-success)] bg-[var(--accent-success)] text-[var(--text-accent)]"
                                    : "border-[var(--border-color)] text-transparent hover:border-[var(--accent-success)]"
                                }`}
                        >
                            ✓
                        </button>
                        <input
                            value={option}
                            onChange={(e) => onChange(replaceItem(options, i, e.target.value), current)}
                            placeholder={`Варіант ${i + 1}`}
                            lang={english ? "en" : "uk"}
                            className={`${inputClass} py-1.5`}
                            aria-label={`Варіант ${i + 1}`}
                        />
                        <ItemControls index={i} count={options.length} onMove={move} onRemove={remove} minItems={2} label={`Варіант ${i + 1}`} />
                    </div>
                );
            })}
            {options.length < 6 && <AddButton onClick={() => onChange([...options, ""], current)}>Додати варіант</AddButton>}
            {current < 0 && <p className="text-xs font-semibold text-[var(--accent-error)]">Познач правильну відповідь</p>}
        </div>
    );
};

const ItemBox: FC<{ title: string; controls: ReactNode; children: ReactNode; tone?: string }> = ({ title, controls, children, tone }) => (
    <div className={`space-y-2 rounded-2xl border border-[var(--border-color)] p-2.5 ${tone ?? ""}`}>
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[var(--text-muted)]">{title}</span>
            {controls}
        </div>
        {children}
    </div>
);

export interface StepFormProps {
    step: StepPayload;
    onChange: (step: StepPayload) => void;
    /** Редактор вкладених кроків (гілки сюжетного вибору) */
    renderBranch: (steps: StepPayload[], onChange: (steps: StepPayload[]) => void, label: string) => ReactNode;
}

export const StepForm: FC<StepFormProps> = ({ step, onChange, renderBranch }) => {
    switch (step.type) {
        case "scene":
            return (
                <div className="space-y-3">
                    <EmojiField label="Іконка" value={step.icon} onChange={(icon) => onChange({ ...step, icon })} />
                    <RichTextField
                        label="Текст сцени"
                        required
                        rows={3}
                        value={step.text}
                        onChange={(text) => onChange({ ...step, text })}
                        placeholder="Ти заходиш у затишну кав'ярню. Пахне кавою…"
                    />
                </div>
            );

        case "event":
            return (
                <div className="space-y-3">
                    <div className="grid grid-cols-[auto_1fr] gap-3">
                        <EmojiField label="Іконка" value={step.icon} onChange={(icon) => onChange({ ...step, icon })} />
                        <SelectField
                            label="Ефект"
                            value={(step.effect ?? "") as (typeof EFFECTS)[number]["value"]}
                            options={EFFECTS}
                            onChange={(effect) => onChange({ ...step, effect: effect || undefined })}
                        />
                    </div>
                    <RichTextField label="Що сталося" required value={step.text} onChange={(text) => onChange({ ...step, text })} placeholder="Бах! Хтось перекинув каву…" />
                </div>
            );

        case "dialogue": {
            const lines = step.lines;
            const setLines = (next: DialogueLine[]) => onChange({ ...step, lines: next });
            const setLine = (i: number, patch: Partial<DialogueLine>) => setLines(replaceItem(lines, i, { ...lines[i], ...patch }));
            return (
                <div className="space-y-2">
                    {lines.map((line, i) => (
                        <ItemBox
                            key={i}
                            title={`Репліка ${i + 1}`}
                            tone={line.speaker === "user" ? "bg-[var(--accent-cta)]/5" : line.speaker === "npc" ? "bg-sky-500/5" : ""}
                            controls={
                                <ItemControls
                                    index={i}
                                    count={lines.length}
                                    onMove={(from, to) => setLines(moveItem(lines, from, to))}
                                    onRemove={(index) => setLines(removeItem(lines, index))}
                                    minItems={1}
                                    label={`Репліка ${i + 1}`}
                                />
                            }
                        >
                            <div className="grid grid-cols-2 gap-2">
                                <SelectField label="Хто говорить" value={line.speaker} options={SPEAKERS} onChange={(speaker) => setLine(i, { speaker })} />
                                {line.speaker === "snacky" ? (
                                    <SelectField
                                        label="Емоція Снекі"
                                        value={(line.emotion ?? "") as (typeof EMOTIONS)[number]["value"]}
                                        options={EMOTIONS}
                                        onChange={(emotion) => setLine(i, { emotion: emotion || undefined })}
                                    />
                                ) : (
                                    <span />
                                )}
                            </div>
                            <RichTextField
                                label="Англійською"
                                required
                                english
                                value={line.en}
                                onChange={(en) => setLine(i, { en })}
                                placeholder="Hello! Nice to meet you."
                                hint="Уся репліка озвучується голосом того, хто говорить."
                            />
                            <TextField label="Переклад" value={line.uk} onChange={(uk) => setLine(i, { uk })} placeholder="Привіт! Приємно познайомитись." />
                        </ItemBox>
                    ))}
                    <AddButton
                        onClick={() => {
                            // Нова репліка — за чергою: після Снекі говорить юзер і навпаки
                            const last = lines[lines.length - 1]?.speaker;
                            setLines([...lines, { speaker: last === "snacky" ? "user" : "snacky", en: "", uk: "" }]);
                        }}
                    >
                        Додати репліку
                    </AddButton>
                </div>
            );
        }

        case "cards": {
            const cards = step.cards;
            const setCards = (next: FlashCardItem[]) => onChange({ ...step, cards: next });
            const setCard = (i: number, patch: Partial<FlashCardItem>) => setCards(replaceItem(cards, i, { ...cards[i], ...patch }));
            return (
                <div className="space-y-2">
                    <TextField label="Заголовок" value={step.title} onChange={(title) => onChange({ ...step, title })} placeholder="Нові слова" />
                    {cards.map((card, i) => (
                        <div key={i} className="flex items-end gap-1.5 rounded-xl border border-[var(--border-color)] p-1.5">
                            <input
                                value={card.emoji ?? ""}
                                onChange={(e) => setCard(i, { emoji: e.target.value })}
                                maxLength={16}
                                placeholder="☕"
                                aria-label={`Емодзі картки ${i + 1}`}
                                className={`${inputClass} w-12 px-1 py-1.5 text-center`}
                            />
                            <input
                                value={card.en}
                                onChange={(e) => setCard(i, { en: e.target.value })}
                                placeholder="coffee"
                                lang="en"
                                aria-label={`Слово ${i + 1}`}
                                className={`${inputClass} py-1.5`}
                            />
                            <input
                                value={card.uk}
                                onChange={(e) => setCard(i, { uk: e.target.value })}
                                placeholder="кава"
                                aria-label={`Переклад ${i + 1}`}
                                className={`${inputClass} py-1.5`}
                            />
                            <ItemControls
                                index={i}
                                count={cards.length}
                                onMove={(from, to) => setCards(moveItem(cards, from, to))}
                                onRemove={(index) => setCards(removeItem(cards, index))}
                                minItems={1}
                                label={`Картка ${i + 1}`}
                            />
                        </div>
                    ))}
                    <AddButton onClick={() => setCards([...cards, { en: "", uk: "", emoji: "" }])}>Додати слово</AddButton>
                </div>
            );
        }

        case "quiz":
            return (
                <div className="space-y-3">
                    <RichTextField
                        label="Репліка персонажа перед питанням"
                        english
                        value={step.npcPrompt}
                        onChange={(npcPrompt) => onChange({ ...step, npcPrompt })}
                        placeholder="What would you like?"
                        hint="Необов'язково. Озвучується голосом персонажа уроку."
                    />
                    <RichTextField label="Питання" required value={step.question} onChange={(question) => onChange({ ...step, question })} placeholder="Як ввічливо попросити чай?" />
                    <OptionsWithCorrect
                        options={step.options}
                        correct={step.correct}
                        english
                        onChange={(options, correct) => onChange({ ...step, options, correct })}
                    />
                    <RichTextField
                        label="Пояснення після відповіді"
                        value={step.explanation}
                        onChange={(explanation) => onChange({ ...step, explanation })}
                        placeholder="<en>please</en> — «будь ласка»."
                        hint="Необов'язково. Показується після правильної відповіді."
                    />
                </div>
            );

        case "listen":
            return (
                <div className="space-y-3">
                    <TextField
                        label="Що звучить (англійською)"
                        required
                        english
                        value={step.audio}
                        onChange={(audio) => onChange({ ...step, audio })}
                        placeholder="A coffee with milk, please."
                        hint="Юзер чує цю фразу, але не бачить її."
                    />
                    <TextField label="Питання" value={step.question} onChange={(question) => onChange({ ...step, question })} placeholder="Що замовили?" />
                    <OptionsWithCorrect
                        options={step.options}
                        correct={step.correct}
                        english={false}
                        onChange={(options, correct) => onChange({ ...step, options, correct })}
                    />
                </div>
            );

        case "reply": {
            const options = step.options;
            const setOptions = (next: ReplyOption[]) => onChange({ ...step, options: next });
            const setOption = (i: number, patch: Partial<ReplyOption>) => setOptions(replaceItem(options, i, { ...options[i], ...patch }));
            return (
                <div className="space-y-3">
                    <RichTextField label="Що каже Снекі" english value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} placeholder="How are you?" />
                    <div className="grid grid-cols-2 gap-2">
                        <TextField label="Переклад" value={step.promptUk} onChange={(promptUk) => onChange({ ...step, promptUk })} placeholder="Як справи?" />
                        <SelectField
                            label="Емоція Снекі"
                            value={(step.emotion ?? "") as (typeof EMOTIONS)[number]["value"]}
                            options={EMOTIONS}
                            onChange={(emotion) => onChange({ ...step, emotion: emotion || undefined })}
                        />
                    </div>
                    {options.map((option, i) => (
                        <ItemBox
                            key={i}
                            title={`Відповідь ${i + 1}`}
                            tone={option.quality === "good" ? "bg-[var(--accent-success)]/5" : option.quality === "bad" ? "bg-[var(--accent-error)]/5" : ""}
                            controls={
                                <ItemControls
                                    index={i}
                                    count={options.length}
                                    onMove={(from, to) => setOptions(moveItem(options, from, to))}
                                    onRemove={(index) => setOptions(removeItem(options, index))}
                                    minItems={2}
                                    label={`Відповідь ${i + 1}`}
                                />
                            }
                        >
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                                <TextField label="Англійською" required english value={option.en} onChange={(en) => setOption(i, { en })} placeholder="I'm fine, thank you!" />
                                <SelectField label="Якість" value={option.quality} options={QUALITIES} onChange={(quality) => setOption(i, { quality })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <TextField label="Переклад" value={option.uk} onChange={(uk) => setOption(i, { uk })} placeholder="Добре, дякую!" />
                                <TextField label="Реакція Снекі" value={option.reaction} onChange={(reaction) => setOption(i, { reaction })} placeholder="Ідеально!" />
                            </div>
                        </ItemBox>
                    ))}
                    <AddButton onClick={() => setOptions([...options, { en: "", uk: "", quality: "ok" }])}>Додати відповідь</AddButton>
                </div>
            );
        }

        case "build": {
            const answer = Array.isArray(step.answer) ? step.answer.join(" ") : step.answer;
            const words = answer.trim().split(/\s+/).filter(Boolean);
            return (
                <div className="space-y-3">
                    <TextField label="Завдання (зазвичай переклад)" value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} placeholder="Можна мені чай, будь ласка?" />
                    <TextField
                        label="Правильне речення"
                        required
                        english
                        value={answer}
                        onChange={(value) => onChange({ ...step, answer: value })}
                        placeholder="Can I have a tea, please?"
                        hint={words.length > 0 ? `Слова в банку: ${words.join(" · ")}` : "Юзер складатиме його зі слів"}
                    />
                    <TextField
                        label="Зайві слова (через пробіл)"
                        english
                        value={(step.distractors ?? []).join(" ")}
                        onChange={(value) => onChange({ ...step, distractors: value.split(/\s+/).filter(Boolean) })}
                        placeholder="is coffee"
                        hint="Необов'язково. Додаються в банк, щоб було складніше."
                    />
                </div>
            );
        }

        case "voice":
            return (
                <div className="space-y-3">
                    <RichTextField label="Що сказати англійською" required english value={step.phrase} onChange={(phrase) => onChange({ ...step, phrase })} placeholder="Nice to meet you!" />
                    <TextField label="Переклад" value={step.uk} onChange={(uk) => onChange({ ...step, uk })} placeholder="Приємно познайомитися!" />
                </div>
            );

        case "choice": {
            const options = step.options;
            const setOptions = (next: ChoiceOption[]) => onChange({ ...step, options: next });
            const setOption = (i: number, patch: Partial<ChoiceOption>) => setOptions(replaceItem(options, i, { ...options[i], ...patch }));
            return (
                <div className="space-y-3">
                    <RichTextField label="Питання / ситуація" value={step.prompt} onChange={(prompt) => onChange({ ...step, prompt })} placeholder="Що робимо далі?" />
                    {options.map((option, i) => (
                        <ItemBox
                            key={i}
                            title={`Варіант ${i + 1}`}
                            controls={
                                <ItemControls
                                    index={i}
                                    count={options.length}
                                    onMove={(from, to) => setOptions(moveItem(options, from, to))}
                                    onRemove={(index) => setOptions(removeItem(options, index))}
                                    minItems={2}
                                    label={`Варіант ${i + 1}`}
                                />
                            }
                        >
                            <div className="grid grid-cols-[auto_1fr] gap-2">
                                <EmojiField label="Іконка" value={option.icon} onChange={(icon) => setOption(i, { icon })} />
                                <TextField label="Текст" required english value={option.text} onChange={(text) => setOption(i, { text })} placeholder="Stay here" />
                            </div>
                            <TextField label="Переклад" value={option.uk} onChange={(uk) => setOption(i, { uk })} placeholder="Лишитися" />
                            {renderBranch(option.outcome ?? [], (outcome) => setOption(i, { outcome }), `Гілка «${option.uk || option.text || `варіант ${i + 1}`}»`)}
                        </ItemBox>
                    ))}
                    {options.length < 4 && <AddButton onClick={() => setOptions([...options, { text: "", uk: "" }])}>Додати варіант</AddButton>}
                </div>
            );
        }

        default:
            return <p className="text-sm text-[var(--text-muted)]">Цей тип кроку редагується лише в JSON.</p>;
    }
};