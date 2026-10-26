# ====================================================================
# Interview Arena Production Containerfile
# ====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build frontend and server assets
RUN npm run build
RUN npm test

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations

# Install tsx globally or locally for server runner
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
