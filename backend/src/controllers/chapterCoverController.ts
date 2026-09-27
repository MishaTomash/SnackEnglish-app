// 📁 Файл: SnackEnglish-app/backend/src/controllers/chapterCoverController.ts
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { Types } from "mongoose";
import { Chapter } from "../models/index";

/**
 * Фото-обкладинка розділу. Будь-яке фото (з телефона, горизонтальне чи вертикальне)
 * обрізається до 16:9 з найцікавішою частиною кадру, зменшується й стискається у WebP —
 * тож у картці розділу воно завжди виглядає однаково акуратно й вантажиться швидко.
 * Без фото розділ показує емодзі, як раніше.
 */

const COVERS_DIR = path.join(process.cwd(), "uploads", "covers");
const COVERS_URL = "/uploads/covers/";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 675; // 16:9

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpe?g|png|webp|heic|heif|gif)$/i.test(file.mimetype)),
});

/** multer з людськими помилками (завеликий файл тощо) замість 500 */
export const coverUpload = (req: Request, res: Response, next: NextFunction): void => {
    upload.single("image")(req, res, (error: unknown) => {
        if (!error) return next();
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ error: "Фото завелике — до 5 МБ" });
            return;
        }
        res.status(400).json({ error: "Не вдалося прочитати файл" });
    });
};

/** Видаляє старий файл обкладинки (лише наш, з папки covers) */
const removeCoverFile = async (url: string | undefined): Promise<void> => {
    if (!url || !url.startsWith(COVERS_URL)) return;
    const name = path.basename(url);
    await unlink(path.join(COVERS_DIR, name)).catch(() => undefined);
};

const findChapter = async (req: Request, res: Response) => {
    const chapterId = String(req.params.chapterId ?? "");
    if (!Types.ObjectId.isValid(chapterId)) {
        res.status(400).json({ error: "Невірний id розділу" });
        return null;
    }
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
        res.status(404).json({ error: "Розділ не знайдено" });
        return null;
    }
    return chapter;
};

// POST /api/stories/admin/chapters/:chapterId/cover  (multipart, поле "image")
export const uploadChapterCover = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await findChapter(req, res);
        if (!chapter) return;
        if (!req.file) {
            res.status(400).json({ error: "Обери фото (JPG, PNG, WEBP або HEIC)" });
            return;
        }

        let image: Buffer;
        try {
            image = await sharp(req.file.buffer)
                .rotate() // орієнтація з EXIF (фото з телефона не буде "лежати на боці")
                .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
                .webp({ quality: 82 })
                .toBuffer();
        } catch {
            res.status(400).json({ error: "Цей файл не схожий на фото" });
            return;
        }

        await mkdir(COVERS_DIR, { recursive: true });
        // Нове ім'я при кожному завантаженні — браузер і Telegram не покажуть старе з кешу
        const fileName = `${String(chapter._id)}-${Date.now().toString(36)}.webp`;
        await writeFile(path.join(COVERS_DIR, fileName), image);

        const previous = chapter.coverImage;
        chapter.coverImage = `${COVERS_URL}${fileName}`;
        await chapter.save();
        await removeCoverFile(previous);

        res.status(200).json({ coverImage: chapter.coverImage });
    } catch (error) {
        console.error("[chapterCover] upload:", error);
        res.status(500).json({ error: "Не вдалося зберегти фото" });
    }
};

// DELETE /api/stories/admin/chapters/:chapterId/cover — повернутися до емодзі
export const deleteChapterCover = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await findChapter(req, res);
        if (!chapter) return;
        const previous = chapter.coverImage;
        chapter.coverImage = "";
        await chapter.save();
        await removeCoverFile(previous);
        res.status(200).json({ coverImage: "" });
    } catch (error) {
        console.error("[chapterCover] delete:", error);
        res.status(500).json({ error: "Не вдалося прибрати фото" });
    }
};