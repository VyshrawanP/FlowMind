# Base image (Slim Debian node)
FROM node:20-slim

# Install OpenSSL if needed for Prisma engine
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install dependencies (only production-grade node_modules)
RUN npm ci --only=production

# Copy source and database models
COPY prisma ./prisma
COPY src ./src

# Generate prisma client
RUN npx prisma generate

# Expose port (default 3001)
EXPOSE 3001

# Command to run on container execution
CMD ["npm", "start"]
