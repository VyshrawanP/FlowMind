import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:');
  missingEnv.forEach((key) => console.error(`   - ${key}`));
  process.exit(1);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || null,
  groqApiKey: process.env.GROQ_API_KEY || null,
  githubToken: process.env.GITHUB_TOKEN || null,
};

export default config;
