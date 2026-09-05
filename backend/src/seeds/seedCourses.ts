/**
 * @deprecated
 * MongoDB більше не використовується для зберігання контенту.
 * Усі юніти та слова завантажуються зі статичних JSON (див. contentService.ts).
 */

import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { Word } from "../models/Word.js";
import { Unit } from "../models/Unit.js";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

// Інтерфейс, що відповідає структурі наших JSON файлів
interface LessonJson {
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  units: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    steps: {
      warmup: Record<string, unknown>;
      vocabulary: Array<{
        text: string;
        transcription: string;
        translation: string;
        exampleSentence: string;
        exampleTranslation: string;
      }>;
      grammar: {
        title: string;
        explanation: string;
        examples: Array<{ en: string; ua: string }>;
      };
      video: { url: string };
      reading: {
        title: string;
        text: string;
        questions: Array<{
          question: string;
          options: string[];
          correctAnswer: number;
        }>;
      };
      speaking: {
        title: string;
        scenario: string;
        lines: Array<{ speaker: string; text: string; translation: string }>;
      };
      test: Array<{
        question: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
      }>;
    };
  }>;
}

async function runSeed(): Promise<void> {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    // Видаляємо застарілі індекси
    try {
      await mongoose.connection.collection("words").dropIndex("wordId_1");
      console.log("Old 'wordId_1' index removed successfully.");
    } catch {
      // Індекс вже відсутній
    }
    try {
      await mongoose.connection.collection("units").dropIndex("unitId_1");
      console.log("Old 'unitId_1' index removed successfully.");
    } catch {
      // Індекс вже відсутній
    }

    let wordsCreated = 0;
    let wordsExisting = 0;
    let unitsCreated = 0;
    let unitsUpdated = 0;

    // Зчитуємо директорію з контентом
    const contentDir = path.resolve(process.cwd(), "content/lessons");
    const levelsFiles = [
      "A1.json",
      "A2.json",
      "B1.json",
      "B2.json",
      "C1.json",
      "C2.json",
    ];

    for (const fileName of levelsFiles) {
      const filePath = path.join(contentDir, fileName);
      let fileContent: string;

      try {
        fileContent = await fs.readFile(filePath, "utf-8");
      } catch (err) {
        console.warn(`[WARN] File ${fileName} not found. Skipping.`);
        continue;
      }

      const parsed: LessonJson = JSON.parse(fileContent);
      const level = parsed.level;

      for (const unitData of parsed.units) {
        // Пропускаємо порожні заготовки без title
        if (!unitData.title) {
          continue;
        }

        const wordIds: mongoose.Types.ObjectId[] = [];
        const wordsToProcess = unitData.steps.vocabulary || [];

        // 1. Створюємо / Отримуємо слова
        for (const wordItem of wordsToProcess) {
          let existingWord = await Word.findOne({
            text: wordItem.text,
            level: level,
          });

          if (!existingWord) {
            existingWord = await Word.create({
              ...wordItem,
              level: level,
            });
            wordsCreated++;
          } else {
            wordsExisting++;
          }
          wordIds.push(existingWord._id as mongoose.Types.ObjectId);
        }

        // 2. Створюємо / Оновлюємо юніт
        const existingUnit = await Unit.findOne({ title: unitData.title });

        const unitPayload = {
          title: unitData.title,
          description: unitData.description || "",
          level: level,
          order: unitData.order,
          wordIds,
          grammar: unitData.steps.grammar,
          videoUrl: unitData.steps.video?.url || "",
          reading: unitData.steps.reading,
          dialogue: unitData.steps.speaking,
          quiz: unitData.steps.test,
        };

        if (!existingUnit) {
          await Unit.create(unitPayload);
          unitsCreated++;
          console.log(`[CREATED UNIT] ${unitData.title} (${level})`);
        } else {
          await Unit.updateOne({ _id: existingUnit._id }, unitPayload);
          unitsUpdated++;
          console.log(`[UPDATED UNIT] ${unitData.title} (${level})`);
        }
      }
    }

    console.log("------------------------------------------");
    console.log("SEEDING SUMMARY:");
    console.log(
      `Words created: ${wordsCreated}, Words existing/reused: ${wordsExisting}`,
    );
    console.log(
      `Units created: ${unitsCreated}, Units updated: ${unitsUpdated}`,
    );
    console.log("Seeding completed successfully!");
  } catch (error: unknown) {
    console.error("Failed to execute seed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
}

void runSeed();
