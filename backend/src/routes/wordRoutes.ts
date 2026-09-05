import { Router } from "express";
import { contentService } from "../services/contentService.js";

const router = Router();

router.post("/batch", (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return void res
        .status(400)
        .json({ error: "Invalid or missing 'ids' array" });
    }

    // ОНОВЛЕНО: Отримуємо всі слова безпосередньо з in-memory сховища
    const words = contentService.getWordsByIds(ids);

    res.status(200).json({ words });
  } catch (error) {
    console.error("Error fetching words batch:", error);
    res.status(500).json({ error: "Failed to fetch words" });
  }
});

export default router;
