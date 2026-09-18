import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { z } from "zod";

// ================= СХЕМИ ВАЛІДАЦІЇ =================

const wordSchema = z.object({
  text: z.string().min(1, "Поле text не може бути порожнім"),
  transcription: z.string().min(1, "Поле transcription не може бути порожнім"),
  translation: z.string().min(1, "Поле translation не може бути порожнім"),
  exampleSentence: z.string().min(3, "Приклад речення занадто короткий"),
  exampleTranslation: z.string().min(3, "Переклад прикладу занадто короткий"),
  audioUrl: z.string().nullable().optional().default(null),
});

const sentenceSchema = z.object({
  text: z.string().min(1, "Речення не може бути порожнім"),
  translation: z.string().min(1, "Переклад не може бути порожнім"),
});

const grammarExampleSchema = z
  .object({
    en: z.string().min(1, "Англійський приклад не може бути порожнім"),
    ua: z.string().min(1, "Переклад прикладу не може бути порожнім"),
    highlightWord: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.highlightWord &&
      !val.en.toLowerCase().includes(val.highlightWord.toLowerCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `highlightWord '${val.highlightWord}' не знайдено у реченні '${val.en}'`,
        path: ["highlightWord"],
      });
    }
  });

// НОВА СХЕМА: Жорсткий контроль реплік у Speaking
const speakingLineSchema = z
  .object({
    speaker: z.string().min(1, "Потрібен speaker"),
    text: z.string().min(1, "Текст репліки обов'язковий"),
    translation: z.string().min(1, "Переклад обов'язковий"),
    expectedPhrase: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.speaker === "You" && !val.expectedPhrase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Репліка 'You' без expectedPhrase — вимову нема з чим звіряти",
        path: ["expectedPhrase"],
      });
    }
  });

const testItemSchema = z.any().superRefine((val, ctx) => {
  // 1. Обов'язкові поля для ВСІХ типів тестів (і щоб вони не були порожніми)
  if (
    !val.skillTag ||
    typeof val.skillTag !== "string" ||
    val.skillTag.trim().length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Бракує непорожнього поля skillTag",
      path: ["skillTag"],
    });
  }
  if (
    !val.explanation ||
    typeof val.explanation !== "string" ||
    val.explanation.trim().length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Бракує поля explanation (пояснення обов'язкове)",
      path: ["explanation"],
    });
  }

  // 2. Специфічні перевірки по типах завдань
  if (val.type === "sentence-scramble") {
    if (!val.sentence || val.sentence.trim().length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля sentence",
        path: ["sentence"],
      });
    if (!val.translation || val.translation.trim().length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля translation",
        path: ["translation"],
      });
  } else if (val.type === "type-answer") {
    if (!val.question || val.question.trim().length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля question",
        path: ["question"],
      });
    if (!val.correctAnswer || val.correctAnswer.trim().length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля correctAnswer",
        path: ["correctAnswer"],
      });
  } else {
    // quiz, grammar, reading
    if (!val.question || val.question.trim().length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля question",
        path: ["question"],
      });
    if (!val.options || !Array.isArray(val.options) || val.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Має бути масив options (мінімум 2)",
        path: ["options"],
      });
    } else {
      val.options.forEach((opt: any, idx: number) => {
        if (typeof opt !== "string" || opt.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Варіант відповіді не може бути порожнім",
            path: ["options", idx],
          });
        }
      });
    }
    if (
      !val.correctAnswer ||
      typeof val.correctAnswer !== "string" ||
      val.correctAnswer.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Бракує поля correctAnswer",
        path: ["correctAnswer"],
      });
    }
    if (
      val.options &&
      val.correctAnswer &&
      !val.options.includes(val.correctAnswer)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Відповідь '${val.correctAnswer}' не серед options`,
        path: ["correctAnswer"],
      });
    }
  }
});

const unitSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional().default(""),
    order: z.number(),
    steps: z.object({
      vocabulary: z.array(wordSchema).min(10, "Мінімум 10 слів у vocabulary"),
      grammar: z
        .object({
          title: z.string().min(1),
          explanation: z.string().min(1),
          examples: z
            .array(grammarExampleSchema)
            .min(3, "Мінімум 3 приклади у grammar"),
        })
        .optional(),
      video: z
        .object({
          url: z.string().optional(),
          caption: z.string().optional(),
          notebookSourceText: z.string().optional(),
          notebookFocusPrompt: z.string().optional(),
          youtubeTitle: z.string().optional(),
          youtubeDescription: z.string().optional(),
        })
        .optional(),
      reading: z.object({
        title: z.string().optional(),
        lines: z.array(sentenceSchema).min(6, "Мінімум 6 речень для читання"),
        questions: z
          .array(testItemSchema)
          .min(3, "Мінімум 3 питання до тексту"),
      }),
      speaking: z.object({
        title: z.string().optional(),
        scenario: z.string().optional(),
        // ТЕПЕР ТУТ СТРОГА СХЕМА З EXPECTED PHRASE
        lines: z
          .array(speakingLineSchema)
          .min(6, "Мінімум 6 реплік у speaking"),
      }),
      test: z.array(testItemSchema).min(10, "Мінімум 10 тестових питань"),
    }),
  })
  .superRefine((unit, ctx) => {
    // GOLDEN CHAIN RULE: Перевіряємо, чи AI реально використав словник у читанні
    if (unit.steps?.reading?.lines && unit.steps?.vocabulary) {
      const readingText = unit.steps.reading.lines
        .map((l) => l.text.toLowerCase())
        .join(" ");
      const vocabWords = unit.steps.vocabulary.map((w) => w.text.toLowerCase());

      if (vocabWords.length > 0) {
        const usedCount = vocabWords.filter((w) =>
          readingText.includes(w),
        ).length;
        const usageRatio = usedCount / vocabWords.length;

        // Якщо AI схалявив і використав менше 70% нових слів у тексті — блокуємо
        if (usageRatio < 0.7) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Лише ${Math.round(usageRatio * 100)}% слів vocabulary використано в reading (треба ≥70%)`,
            path: ["steps", "reading"],
          });
        }
      }
    }
  });

// ================= СЕРВІС =================

class ContentService {
  private unitsByLevel = new Map<string, any[]>();
  private allUnitsById = new Map<string, any>();
  private wordsById = new Map<string, any>();

  private generateObjectId(seed: string): string {
    return crypto.createHash("md5").update(seed).digest("hex").slice(0, 24);
  }

  async init(): Promise<void> {
    const contentDir = path.resolve(process.cwd(), "content/lessons");
    let files: string[] = [];

    try {
      files = await fs.readdir(contentDir);
    } catch (err) {
      console.warn(
        `[ContentService] Directory ${contentDir} not found. Content skipped.`,
      );
      return;
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(contentDir, file);

      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);

        if (!parsed.level || !Array.isArray(parsed.units)) {
          console.error(
            `❌ [Помилка] Файл ${file} має невірний базовий формат (бракує level або units).`,
          );
          continue;
        }

        const level = parsed.level;
        const mappedUnits = [];

        for (const u of parsed.units) {
          // БЕЗПЕЧНА ВАЛІДАЦІЯ КОЖНОГО ЮНІТУ
          const validationResult = unitSchema.safeParse(u);

          if (!validationResult.success) {
            console.error(
              `\n❌ [Помилка Валідації] Файл: ${file} | Юніт ID: ${u.id || "НЕВІДОМО"}`,
            );
            validationResult.error.issues.forEach((issue) => {
              console.error(
                `   -> Поле: [${issue.path.join(".")}] | Помилка: ${issue.message}`,
              );
            });
            continue; // Пропускаємо зламаний юніт, але сервер продовжує працювати
          }

          const validUnit = validationResult.data;

          // 1. Vocabulary: перевірка на мінімальну кількість слів (Попередження, не блокує завантаження)
          if (
            validUnit.steps.vocabulary &&
            validUnit.steps.vocabulary.length < 6
          ) {
            console.warn(
              `⚠️ [Попередження] Файл: ${file} | Юніт: ${validUnit.id} -> Vocabulary має лише ${validUnit.steps.vocabulary.length} слів (замало для повноцінного уроку).`,
            );
          }

          const unitMongoId = this.generateObjectId(
            `unit_${level}_${validUnit.id}`,
          );
          const wordIds: string[] = [];

          if (validUnit.steps.vocabulary) {
            for (const w of validUnit.steps.vocabulary) {
              const wordMongoId = this.generateObjectId(
                `word_${level}_${validUnit.id}_${w.text}`,
              );
              const wordObj = {
                _id: wordMongoId,
                id: wordMongoId,
                level,
                ...w,
              };
              this.wordsById.set(wordMongoId, wordObj);
              wordIds.push(wordMongoId);
            }
          }

          const unitObj = {
            _id: unitMongoId,
            id: validUnit.id,
            title: validUnit.title,
            level: level,
            topic: validUnit.description || "",
            order: validUnit.order,
            grammarTopic: validUnit.steps.grammar?.title || "",
            grammarExplanation: validUnit.steps.grammar?.explanation || "",
            grammar: validUnit.steps.grammar,
            video: validUnit.steps.video,
            reading: validUnit.steps.reading,
            speaking: validUnit.steps.speaking,
            test: validUnit.steps.test,
            wordIds: wordIds,
            steps: validUnit.steps, // Зберігаємо оригінальну структуру для сумісності
          };

          mappedUnits.push(unitObj);
          this.allUnitsById.set(validUnit.id, unitObj);
          this.allUnitsById.set(unitMongoId, unitObj);
        }

        this.unitsByLevel.set(level, mappedUnits);
        console.log(
          `[ContentService] Loaded ${mappedUnits.length} valid units for level ${level}`,
        );
      } catch (err) {
        console.error(`[ContentService] System Error parsing ${file}:`, err);
      }
    }
  }

  getUnitsByLevel(level: string) {
    return this.unitsByLevel.get(level) || [];
  }
  getUnitById(id: string) {
    return this.allUnitsById.get(id);
  }
  getUnitByOrder(level: string, order: number) {
    return this.getUnitsByLevel(level).find((u) => u.order === order);
  }
  getWordsByIds(ids: string[]) {
    return ids.map((id) => this.wordsById.get(id)).filter(Boolean);
  }
  getWordById(id: string) {
    return this.wordsById.get(id);
  }
}

export const contentService = new ContentService();
