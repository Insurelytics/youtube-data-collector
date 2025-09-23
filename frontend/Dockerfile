FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
# Use legacy-peer-deps to avoid upstream peer dependency conflicts during install
RUN npm ci --legacy-peer-deps

# Copy all frontend files from the build context (./frontend)
COPY . ./
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

EXPOSE 3000
# Do not hardcode PORT here; expansion happens at runtime from the container environment
CMD ["sh", "-lc", "node ./node_modules/next/dist/bin/next start -p ${PORT:-3000}"]


