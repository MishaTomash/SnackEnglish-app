import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { z } from "zod";

// Валідація структури JSON
const wordSchema = z.object({
  text: z.string(),
  transcription: z.string(),
  translation: z.string(),
  exampleSentence: z.string(),
  exampleTranslation: z.string(),
});

const unitSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(""),
  order: z.number(),
  steps: z
    .object({
      vocabulary: z.array(wordSchema).optional(),
      grammar: z
        .object({
          title: z.string(),
          explanation: z.string(),
          examples: z
            .array(z.object({ en: z.string(), ua: z.string() }))
            .optional(),
        })
        .optional(),
      video: z.object({ url: z.string() }).optional(),
      reading: z
        .object({
          title: z.string(),
          text: z.string(),
          translation: z.string().optional(),
          questions: z.array(z.any()).optional(),
        })
        .optional(),
      speaking: z.any().optional(),
      test: z.array(z.any()).optional(),
    })
    .optional()
    .default({}),
});

const levelFileSchema = z.object({
  level: z.string(),
  units: z.array(unitSchema),
});

class ContentService {
  private unitsByLevel = new Map<string, any[]>();
  private allUnitsById = new Map<string, any>();
  private wordsById = new Map<string, any>();

  // Генерує стабільний 24-значний hex-ідентифікатор (як в MongoDB) для сумісності з UserProgress
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
        levelFileSchema.parse(parsed); // Викине помилку, якщо JSON пошкоджений

        const level = parsed.level;
        const mappedUnits = [];

        for (const u of parsed.units) {
          const unitMongoId = this.generateObjectId(`unit_${level}_${u.id}`);
          const wordIds: string[] = [];

          if (u.steps?.vocabulary) {
            for (const w of u.steps.vocabulary) {
              const wordMongoId = this.generateObjectId(
                `word_${level}_${u.id}_${w.text}`,
              );
              const wordObj = {
                _id: wordMongoId,
                id: wordMongoId,
                level: level,
                ...w,
              };
              this.wordsById.set(wordMongoId, wordObj);
              wordIds.push(wordMongoId);
            }
          }

          const unitObj = {
            _id: unitMongoId,
            id: u.id,
            title: u.title,
            level: level,
            topic: u.description || "",
            order: u.order,
            grammarTopic: u.steps?.grammar?.title || "",
            grammarExplanation: u.steps?.grammar?.explanation || "",
            grammar: u.steps?.grammar,
            videoUrl: u.steps?.video?.url || "",
            readingText: u.steps?.reading?.text || "",
            readingTranslation: u.steps?.reading?.translation || "",
            wordIds: wordIds,
          };

          mappedUnits.push(unitObj);
          this.allUnitsById.set(u.id, unitObj);
          this.allUnitsById.set(unitMongoId, unitObj); // Доступ як по 'u1', так і по hex-ID
        }

        this.unitsByLevel.set(level, mappedUnits);
        console.log(
          `[ContentService] Loaded ${mappedUnits.length} units for level ${level}`,
        );
      } catch (err) {
        console.error(
          `[ContentService] Error parsing/validating ${file}:`,
          err,
        );
        // Не зупиняємо сервер через один битий файл, але чітко сигналізуємо
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
