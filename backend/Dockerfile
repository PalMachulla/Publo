FROM node:20-alpine AS base

# Development stage
FROM base AS development
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Expose port
EXPOSE 4001

# Start the dev server
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY package*.json ./
RUN npm ci --only=production

COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist

USER nodejs

EXPOSE 4001

CMD ["node", "dist/index.js"]

