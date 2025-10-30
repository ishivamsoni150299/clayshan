# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
ENV CI=true \
    npm_config_loglevel=warn \
    npm_config_fund=false \
    npm_config_audit=false
COPY package*.json ./
RUN npm ci --no-audit --no-fund --omit=optional
COPY . .
# Build Angular SSR bundles
RUN npx ng build

# --- Runtime stage ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy only runtime bits
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/.env.example ./
# Install prod deps only (if any server-side deps existed beyond dist)
# Omit optional deps to avoid platform-specific native modules during install
RUN npm ci --omit=dev --no-audit --no-fund --omit=optional || true
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/products').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/clayshan/server/server.mjs"]
