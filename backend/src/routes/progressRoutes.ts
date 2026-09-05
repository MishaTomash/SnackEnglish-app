import { Router } from "express";

const router = Router();

// Mock-ендпоінт для отримання слів на повторення
router.get("/practice", (req, res) => {
  try {
    // Тимчасові заглушки, поки немає з'єднання з БД progress
    const mockWords = [
      {
        id: "1",
        text: "cookie",
        transcription: "[ˈkʊk.i]",
        translation: "печиво",
        exampleSentence: "I love chocolate chip cookies.",
        exampleTranslation: "Я обожнюю печиво з шоколадною крихтою.",
      },
      {
        id: "2",
        text: "snack",
        transcription: "[snæk]",
        translation: "перекус",
        exampleSentence: "Let's grab a quick snack.",
        exampleTranslation: "Давай швидко перекусимо.",
      },
    ];

    res.status(200).json({ count: mockWords.length, words: mockWords });
  } catch (error) {
    console.error("Error in GET /practice:", error);
    res.status(500).json({ error: "Failed to fetch practice queue" });
  }
});

// Mock-ендпоінт для збереження оцінки SM-2
router.post("/review", (req, res) => {
  try {
    const { wordId, quality } = req.body;

    if (!wordId || quality === undefined) {
      res.status(400).json({ error: "wordId and quality are required" });
      return;
    }

    res.status(200).json({
      success: true,
      repetitions: 1,
      interval: 1,
      nextReviewDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in POST /review:", error);
    res.status(500).json({ error: "Failed to review word" });
  }
});

export default router;
