# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency structures
COPY package*.json ./

# Install dependencies including devDependencies (needed for build)
RUN npm install

# Copy actual source files
COPY . .

# Define build argument for API URL
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Run build to generate .next directory
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy static assets and built next assets from the build stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Next.js default port
EXPOSE 3000

# Execute next production runner
CMD ["npm", "start"]
