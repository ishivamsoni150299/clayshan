Deployment Guide (Render + Vercel)

Overview
- This is an Angular 20 SSR app with a Node/Express server and Supabase backend.
- Deploy as a single Node web service. Two easy options are included:
  1) Render via render.yaml (Docker)
  2) Vercel via Dockerfile (@vercel/docker)

Environment Variables
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE (server-only)
- SUPABASE_ANON_KEY
- SUPABASE_STORAGE_BUCKET=product-images
- ADMIN_EMAILS (comma-separated admin emails)
- RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (optional)
- PORT=4000

Render (recommended for SSR + Express)
1. Push this repo to GitHub.
2. In Render dashboard: New > Blueprint > select this repo (render.yaml is in root).
3. Set environment variables (SUPABASE_*, ADMIN_EMAILS, Razorpay keys if any).
4. Deploy. Render will build via Dockerfile and expose on port 4000.

Vercel (using Docker)
Important: Do NOT use the legacy `@vercel/docker` builder. Vercel auto-detects a Dockerfile now. We have removed `vercel.json` so Vercel uses the Dockerfile directly.
1. Push this repo to GitHub.
2. In Vercel dashboard: New Project > Import > select this repo.
3. Framework preset: “Other”. Root directory: repository root (Dockerfile in root).
4. Set the environment variables in Project Settings > Environment Variables.
5. Deploy. Vercel will build the Dockerfile and run the server on port defined by `PORT` (4000).

Local Production Run
1. npm ci
2. npx ng build
3. node dist/clayshan/server/server.mjs

Notes
- Do not commit real secrets; use the platform’s environment variable settings.
- If running behind a proxy/CDN, we already respect X-Forwarded-Proto/Host for absolute URLs during SSR.
- Set your WhatsApp number in src/app/config.ts (WHATSAPP_NUMBER) before launching.
