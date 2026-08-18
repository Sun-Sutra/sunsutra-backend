import express from 'express';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = express.Router();

// Initialize R2 Client using environment variables
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// GET /api/media
// Retrieves a list of all objects in the bucket, generating pre-signed URLs for each
router.get('/', async (req, res) => {
  if (!BUCKET_NAME || !process.env.R2_ACCESS_KEY_ID) {
    return res.status(500).json({ error: 'R2 storage is not configured in environment variables.' });
  }

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'bills/', // Only fetch from the bills directory where we upload
    });

    const response = await r2Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      return res.json({ success: true, files: [] });
    }

    // Map through the objects and generate pre-signed URLs
    const filePromises = response.Contents.map(async (item) => {
      let url = '';
      
      // If a public URL is configured, use it directly (faster)
      if (process.env.R2_PUBLIC_URL) {
        url = `${process.env.R2_PUBLIC_URL}/${item.Key}`;
      } else {
        // Otherwise, generate a 1-hour presigned URL securely
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.Key,
        });
        url = await getSignedUrl(r2Client, getCommand, { expiresIn: 3600 });
      }

      return {
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        url: url,
        isPdf: item.Key.toLowerCase().endsWith('.pdf'),
      };
    });

    const files = await Promise.all(filePromises);

    // Sort by most recently uploaded
    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    return res.json({ success: true, files });
  } catch (err) {
    console.error('Failed to list R2 media:', err);
    return res.status(500).json({ error: 'Failed to retrieve media files' });
  }
});

export default router;
