# ── Stage 1: Build React Dashboard ──
FROM node:20-alpine AS dashboard-build

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ ./
RUN npm run build

# ── Stage 2: Backend + Dashboard Static ──
FROM node:20-alpine

WORKDIR /app

# Backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy built dashboard from stage 1
COPY --from=dashboard-build /app/dashboard/dist ./dashboard

EXPOSE 3000

CMD ["node", "server.js"]
