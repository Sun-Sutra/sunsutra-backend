import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { processOCRText } from './routes/analyze.js';
import { uploadMiddleware, uploadFile } from './routes/upload.js';

import otpRoutes from './routes/otp.js';
import mediaRoutes from './routes/media.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Headers ──
app.use(helmet());

// ── CORS ──
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'https://sunsutragroup.com',
  'https://www.sunsutragroup.com',
  process.env.FRONTEND_URL, // Flexible override via env
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
}));

// ── Rate Limiters ──
// General: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', generalLimiter);

// Strict: OTP endpoint — 5 requests per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 15 minutes.' },
});

// Moderate: AI analysis & upload — 20 requests per 15 minutes per IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for analysis requests.' },
});

app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OTP endpoint for Admin Auth (strict: 5 req / 15 min)
app.use('/api/otp', otpLimiter, otpRoutes);

// Media gallery endpoint
app.use('/api/media', mediaRoutes);

// AI analysis endpoint (moderate: 20 req / 15 min)
app.post('/api/analyze', aiLimiter, processOCRText);

// File upload endpoint (moderate: 20 req / 15 min)
app.post('/api/upload', aiLimiter, uploadMiddleware, uploadFile);

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
