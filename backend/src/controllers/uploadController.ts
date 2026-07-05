import type { Request, Response } from "express";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuid } from "uuid";
import { fileURLToPath } from "url";
import { uploadToS3, isS3Configured } from "../lib/s3.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIMS: Record<string, [number, number]> = {
  avatar: [256, 256],
  poster: [1200, 630],
  banner: [1440, 400],
  logo:   [256, 256],
};

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const type = (req.query["type"] as string) ?? "poster";
  if (!DIMS[type]) {
    res.status(400).json({ error: "Invalid upload type. Use avatar, poster, banner, or logo." });
    return;
  }

  const [w, h] = DIMS[type]!;
  const filename = `${uuid()}.webp`;

  const webpBuffer = await sharp(req.file.buffer)
    .resize(w, h, { fit: "cover", position: "center" })
    .webp({ quality: 85 })
    .toBuffer();

  if (isS3Configured()) {
    const key = `uploads/${type}/${filename}`;
    const url = await uploadToS3(key, webpBuffer);
    res.json({ url });
  } else {
    // Fallback: local disk (dev only — not suitable for production)
    const dir = path.join(__dirname, "../../../public/uploads", type);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), webpBuffer);
    res.json({ url: `/uploads/${type}/${filename}` });
  }
}
