import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Simple in-memory store for OTPs
// In production, use Redis or Firestore with a TTL
const otpStore = new Map();

// OTP Expiration time (5 minutes)
const OTP_EXPIRATION_MS = 5 * 60 * 1000;

// Reusable transporter
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

router.post('/send', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.endsWith('@sunsutragroup.com')) {
    return res.status(400).json({ error: 'Valid @sunsutragroup.com email is required.' });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP credentials are not set in .env');
    return res.status(500).json({ error: 'Email service is not configured on the server.' });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + OTP_EXPIRATION_MS;

  // Store in memory
  otpStore.set(email, { otp, expiresAt });

  // DEV: Log the OTP to the console so the user can see it if email delivery is delayed
  console.log(`\n=== DEV OTP FOR ${email} ===`);
  console.log(`OTP Code: ${otp}`);
  console.log(`===========================\n`);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Sun Sutra Admin" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Admin Verification Code',
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Sun Sutra Admin Verification</h2>
          <p>Please use the following 6-digit code to complete your admin registration:</p>
          <h1 style="font-size: 32px; letter-spacing: 2px; color: #5d7052;">${otp}</h1>
          <p><em>This code will expire in 5 minutes.</em></p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    res.status(500).json({ error: 'Failed to send OTP email.' });
  }
});

router.post('/verify', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP code.' });
  }

  // OTP matches and is valid
  otpStore.delete(email); // Prevent reuse
  res.json({ success: true, message: 'OTP verified successfully.' });
});

export default router;
