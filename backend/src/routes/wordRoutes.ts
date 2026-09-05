import { Router } from "express";
import { Word } from "../models/Word.js";

const router = Router();

router.post("/batch", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ error: "Invalid or missing 'ids' array" });
      return;
    }

    // Знаходимо всі слова, які належать цьому юніту
    const words = await Word.find({ _id: { $in: ids } });

    res.status(200).json({ words });
  } catch (error) {
    console.error("Error fetching words batch:", error);
    res.status(500).json({ error: "Failed to fetch words" });
  }
});

export default router;
