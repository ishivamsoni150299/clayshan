Clayshan Production Readiness Guide

Overview
- Angular 20 SSR UI + Node/Express backend
- Supabase for data (products, orders, inquiries) + Storage for images
- Deploy as a single Render web service using the Dockerfile + render.yaml

Environment Variables
- Required
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE (server-only; keep secret)
  - SUPABASE_ANON_KEY (for auth endpoints if used)
  - SUPABASE_STORAGE_BUCKET=product-images
  - ADMIN_EMAILS=comma,separated,emails (admin UI allowed emails)
  - PORT=4000 (Render sets automatically)
- Optional
  - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (checkout)
  - CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com (restricts API CORS)

Supabase Schema
- Tables
  - public.products: id, name, slug (unique), price, currency, images[], description, category, tags[], created_at, updated_at
  - public.orders: id, razorpay_order_id, razorpay_payment_id, amount, currency, email, items jsonb, status, created_at, updated_at
  - public.inquiries: id, name, email, message, created_at
- RLS
  - products: enabled; public read policy for selects
  - orders: enabled; server uses service role
  - inquiries: enabled; server inserts via service role
- Indexes
  - products(category), products(created_at desc)
  - orders(created_at desc)
- Migrations
  - supabase/migrations/* include schema and indexes

Images & Storage
- Bucket: product-images (public)
- UI prefers WebP via <picture> when both .webp and .jpg/.png exist
- Helper script: npm run images:gen-upload (optional) to generate WebP and upload to Storage
- See README_ASSETS.md for detailed guidelines

Server Endpoints
- Public
  - GET /api/products, GET /api/products/:slug
  - GET /api/categories
  - POST /api/contact (stores inquiry)
  - GET /api/orders/:id?email=... (public order lookup)
  - GET /robots.txt, GET /sitemap.xml
  - GET /healthz (liveness/readiness; includes supabase ping)
- Auth/Admin
  - POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
  - Admin products CRUD: POST/PUT/DELETE /api/admin/products
  - Admin orders: GET /api/admin/orders, GET /api/admin/orders/:id
  - Admin upload: POST /api/admin/upload (to Supabase Storage)
  - Admin seed: POST /api/admin/seed and POST /api/admin/seed/more
  - Admin rehost: POST /api/admin/rehost-images

Security
- CORS: set CORS_ORIGIN to your production domains (comma-separated). Server reflects only allowed origins.
- Cookies: admin cookies are httpOnly, sameSite=lax; ensure HTTPS in production via Render.
- Secrets: set only via Render env; do not commit credentials.

Deployment (Render)
1. Push to GitHub with Dockerfile and render.yaml
2. Render → New → Blueprint → select repo; set envs above
3. Render builds Angular SSR (npx ng build) and runs Node 20 server
4. Health: Render healthcheck hits /api/products (Dockerfile) and you can also query /healthz

Local Run (Node 20)
1. npm ci
2. npx ng build
3. node dist/clayshan/server/server.mjs

Operational Checklist
- Observability: Inspect Render logs; consider adding request IDs in future
- Backups: Supabase provides daily backups on paid tiers; export products/orders periodically if needed
- Rate limiting: For high-traffic, add a limiter (e.g., express-rate-limit) for public endpoints
- Images: Prefer CDN (Render → Cloudflare in front) for asset caching; Storage URLs are cacheable

Team Setup
- Development
  - Use supabase CLI for local dev if needed; migrations live under supabase/migrations
  - ENV via .env (git-ignored). Do not commit secrets.
- Admin usage
  - Login using Supabase Auth; admin privileges based on ADMIN_EMAILS
  - Use Admin → Products to upload images to Storage, CRUD products, seed sample data
  - Use Admin → Orders for basic order viewing

