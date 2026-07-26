import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// Configure Cloudflare R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Multer config — store in memory, limit 10MB
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
    }
  },
});

// Middleware to handle single file upload
export const uploadMiddleware = upload.single('file');

// Route handler
export async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  if (!BUCKET_NAME || !process.env.R2_ACCESS_KEY_ID) {
    console.error('R2 credentials are not configured in .env');
    return res.status(500).json({ error: 'Storage not configured. Contact administrator.' });
  }

  try {
    // Generate a unique filename
    const ext = path.extname(req.file.originalname);
    const uniqueName = `bills/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    }));

    // Build the public URL (if you've set up a custom domain or public bucket)
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${uniqueName}`
      : uniqueName; // fallback to just the key

    return res.json({
      success: true,
      key: uniqueName,
      url: publicUrl,
      originalName: req.file.originalname,
    });
  } catch (error) {
    console.error('R2 Upload Error:', error);
    return res.status(500).json({ error: 'Failed to upload file: ' + error.message });
  }
}
