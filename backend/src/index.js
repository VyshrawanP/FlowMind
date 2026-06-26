import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import config from './config/index.js';
import { initSocket } from './socket.js';

// Middleware imports
import { requestLogger } from './middlewares/request-logger.js';
import { errorHandler } from './middlewares/error-handler.js';

// Route imports
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

// Request logging middleware
app.use(requestLogger);

// CORS configuration (supports all origins for flexibility, configure specifically if needed)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/boards/:boardId/github-import', githubRoutes);

// AI stream and triggers mounting
app.use('/api/boards', aiStreamRouter);
app.use('/api', cronRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', environment: config.env, timestamp: new Date().toISOString() });
});

// Centralized Error Handler (must be registered last)
app.use(errorHandler);

const PORT = config.port;

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 FlowMind Backend Server running on port ${PORT}`);
  console.log(`=================================================`);
});
