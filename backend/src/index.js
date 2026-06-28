import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import config from './config/index.js';
import { initSocket } from './socket.js';

// Middleware imports
import { requestLogger } from './middlewares/request-logger.js';
import { errorHandler } from './middlewares/error-handler.js';
import { globalLimiter } from './middlewares/rate-limiter.js';
import { authenticateToken } from './middlewares/auth.js';

// Route imports
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
import boardRoutes from './routes/boards.js';
import columnRoutes from './routes/columns.js';
import cardRoutes from './routes/cards.js';
import githubRoutes from './routes/github.js';
import aiStreamRouter from './routes/ai-stream.js';
import cronRouter, { initCronJobs } from './services/cron.js';

const app = express();
const server = createServer(app);

// Initialize Socket.io with Redis adapter
initSocket(server);

// Initialize background cron jobs for AI audits
initCronJobs();

// 1. Basic Security Headers (Helmet protects against DDoS, Clickjacking, MIME-sniffing, XSS)
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP temporarily if it blocks local assets during dev
}));

// 2. Global Rate Limiter (Max 100 requests per 15 mins per IP)
app.use(globalLimiter);

// 3. Request Logger
app.use(requestLogger);

// 4. CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// --- PUBLIC ROUTES ---
app.use('/api/auth', authRoutes);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', environment: config.env, timestamp: new Date().toISOString() });
});

// --- PROTECTED ROUTES (JWT Required) ---
app.use(authenticateToken); // Protects all mounted routers below

app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/boards/:boardId/github-import', githubRoutes);

// AI stream and triggers mounting
app.use('/api/boards', aiStreamRouter);
app.use('/api', cronRouter);

// Centralized Error Handler (must be registered last)
app.use(errorHandler);

const PORT = config.port;

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 FlowMind Backend Server running on port ${PORT}`);
  console.log(`=================================================`);
});
