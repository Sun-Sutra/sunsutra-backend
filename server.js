import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { processOCRText } from './routes/analyze.js';
import { uploadMiddleware, uploadFile } from './routes/upload.js';

import otpRoutes from './routes/otp.js';
import mediaRoutes from './routes/media.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow your Vite dev server and production domain
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:4173',
    // Add your production domain here later, e.g.:
    // 'https://your-domain.vercel.app'
  ],
}));

app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OTP endpoint for Admin Auth
app.use('/api/otp', otpRoutes);

// Media gallery endpoint
app.use('/api/media', mediaRoutes);

// AI analysis endpoint — receives OCR text, returns structured JSON
app.post('/api/analyze', processOCRText);

// File upload endpoint — saves bill image/PDF to Cloudflare R2
app.post('/api/upload', uploadMiddleware, uploadFile);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  
  // Prevent Render from sleeping by pinging the healthcheck every 14 minutes
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    console.log(`[Healthcheck] Setting up 14-minute ping for ${RENDER_URL}`);
    setInterval(() => {
      fetch(`${RENDER_URL}/api/health`)
        .then(res => console.log(`[Healthcheck] Ping successful: ${res.status}`))
        .catch(err => console.error(`[Healthcheck] Ping failed:`, err.message));
    }, 14 * 60 * 1000);
  }
});
