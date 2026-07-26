# Sun Sutra Backend

This is the backend service for the Sun Sutra web application. It is built with Node.js and Express to securely handle AI processing and file storage.

## Purpose

The backend was introduced to securely manage sensitive operations that cannot be safely exposed to the frontend browser:
1. AI Integration: It holds the Groq API key securely and communicates with the LLaMA 3.1 model to parse OCR text extracted from electricity bills.
2. Cloud Storage: It holds Cloudflare R2 credentials to securely upload and store user electricity bills.

## API Endpoints

- GET /api/health
  Returns a simple health check status.

- POST /api/analyze
  Accepts raw OCR text in the request body. Sends this text to the Groq API with a specific prompt to extract energy billing data (e.g., consumer number, monthly consumption, connected load). Returns a structured JSON object.

- POST /api/upload
  Accepts a multipart/form-data file upload (images or PDFs). Generates a unique filename and uploads the file to a Cloudflare R2 bucket using the AWS S3 SDK. Returns the file key and public URL (if configured).

## Tech Stack

- Node.js & Express.js
- @aws-sdk/client-s3 (for Cloudflare R2)
- multer (for handling file uploads)
- cors (for enabling frontend access)
- dotenv (for environment variable management)

## Setup and Development

1. Install Dependencies
Navigate to the backend directory and run:
npm install

2. Environment Configuration
Duplicate the .env.example file and rename it to .env. Fill in the required credentials:
- PORT: The port the server will run on (defaults to 3001).
- GROQ_API_KEY: Your API key from Groq for the AI model.
- R2_ACCOUNT_ID: Your Cloudflare account ID.
- R2_ACCESS_KEY_ID: Your Cloudflare R2 access key.
- R2_SECRET_ACCESS_KEY: Your Cloudflare R2 secret key.
- R2_BUCKET_NAME: The name of the Cloudflare R2 bucket.
- R2_PUBLIC_URL: (Optional) The public URL domain for the bucket if public access is enabled.

3. Start the Server
Start the development server with:
npm run dev

The server will start on http://localhost:3001 (or the port specified in your .env file). Ensure your frontend is configured to point to this URL.
# sunsutra-backend
