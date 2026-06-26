# Base image
FROM node:20-alpine

# Install OpenSSL for Prisma client library engine compatibility
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install dependencies (only production-grade node_modules)
RUN npm ci --only=production

# Copy source and database models
COPY prisma ./prisma
COPY src ./src

# Generate prisma client (so it is baked into the image)
RUN npx prisma generate

# Expose port (default 3001)
EXPOSE 3001

# Command to run on container execution
CMD ["npm", "start"]
