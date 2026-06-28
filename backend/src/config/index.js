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
  groqBaseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  githubToken: process.env.GITHUB_TOKEN || null,
  jwtSecret: process.env.JWT_SECRET || 'flowmind-super-secret-key-change-in-prod',
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'FlowMind Security <noreply@flowmind.com>',
  }
};

// Security check for production deployments
if (config.env === 'production') {
  if (config.jwtSecret === 'flowmind-super-secret-key-change-in-prod') {
    console.warn('⚠️  SECURITY WARNING: Using default fallback JWT secret in production mode. Please define JWT_SECRET in your .env file!');
  }
}

export default config;
