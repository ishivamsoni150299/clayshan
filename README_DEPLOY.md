Deployment Guide (Render)

Overview
- Angular 20 SSR app with a Node/Express server and Supabase backend.
- Deploy as a single web service on Render using the included Dockerfile and render.yaml.

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
4. Deploy. Render will build with Node 20 (Dockerfile) and expose on port 4000.

Local Production Run
1. `npm ci`
2. `npx ng build`
3. `node dist/clayshan/server/server.mjs` (use Node 20)

Local Production Run
1. npm ci
2. npx ng build
3. node dist/clayshan/server/server.mjs

Notes
- Do not commit real secrets; use the platform’s environment variable settings.
- If running behind a proxy/CDN, we already respect X-Forwarded-Proto/Host for absolute URLs during SSR.
- Set your WhatsApp number in src/app/config.ts (WHATSAPP_NUMBER) before launching.
