FROM node:20-slim AS builder
WORKDIR /app

# Install build deps for native modules (better-sqlite3 etc.)
RUN apt-get update && apt-get install -y python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --only=production

# Copy source after installing deps to use Docker cache effectively
COPY backend/ ./

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies for media processing and downloads
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
        ca-certificates \
        python3 \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp standalone binary (avoids outdated apt and pip issues)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Copy built node_modules and source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

EXPOSE 4000

CMD ["node", "src/server.js"]


