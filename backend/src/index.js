import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket } from './socket.js';

// Route imports
import userRoutes from './routes/users.js';
import boardRoutes from './routes/boards.js';
import columnRoutes from './routes/columns.js';
import cardRoutes from './routes/cards.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.io with Redis adapter
initSocket(server);

// Middleware
app.use(cors({
  origin: '*', // Adjust for production environments
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error('Express error handler caught:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 FlowMind Backend Server running on port ${PORT}`);
  console.log(`=================================================`);
});
