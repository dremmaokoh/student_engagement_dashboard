import multer from "multer";
import { HttpError } from "../utils/httpError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const name = String(file.originalname || "").toLowerCase();
    const type = String(file.mimetype || "");
    if (name.endsWith(".csv") || type === "text/csv" || type === "application/vnd.ms-excel") {
      callback(null, true);
      return;
    }
    callback(new HttpError(400, "Only .csv files are accepted."));
  },
});

export const uploadCsv = upload.single("file");
