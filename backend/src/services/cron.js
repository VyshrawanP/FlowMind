import cron from 'node-cron';
import prisma from '../db.js';
import { runAiAnalysis } from './ai-service.js';
import { runWeeklyDigest } from './digest-service.js';
import express from 'express';

const router = express.Router();

// POST /api/boards/:boardId/trigger-ai
router.post('/boards/:boardId/trigger-ai', async (req, res) => {
  const { boardId } = req.params;
  try {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return res.status(404).json({ error: 'Board workspace not found.' });
    }

    runAiAnalysis(boardId);

    res.json({ success: true, message: 'AI Analysis triggered. Connect to stream to view progress.' });
  } catch (error) {
    console.error('Manual AI trigger failed:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/boards/:boardId/trigger-digest
router.post('/boards/:boardId/trigger-digest', async (req, res) => {
  const { boardId } = req.params;
  try {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return res.status(404).json({ error: 'Board workspace not found.' });
    }

    const report = await runWeeklyDigest(boardId);
    res.status(201).json(report);
  } catch (error) {
    console.error('Manual Digest trigger failed:', error);
    res.status(500).json({ error: 'Failed to generate weekly digest.' });
  }
});

// GET /api/boards/:boardId/digest-reports
router.get('/boards/:boardId/digest-reports', async (req, res) => {
  const { boardId } = req.params;
  try {
    const reports = await prisma.digestReport.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    console.error('Fetching weekly digests failed:', error);
    res.status(500).json({ error: 'Failed fetching weekly digests.' });
  }
});

// Initialize background cron schedules
export function initCronJobs() {
  console.log('Registering FlowMind automated background cron jobs...');

  // Background audit every 6 hours (0 */6 * * *)
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running automated 6-hourly AI Project Manager board audit...');
    try {
      const boards = await prisma.board.findMany({ select: { id: true } });
      for (const board of boards) {
        console.log(`Auditing board: ${board.id}`);
        await runAiAnalysis(board.id);
      }
      console.log('Automated AI Project Manager audit completed.');
    } catch (error) {
      console.error('Error during scheduled AI audits:', error);
    }
  });

  // Weekly audit on Monday 9:00 AM (0 9 * * 1)
  cron.schedule('0 9 * * 1', async () => {
    console.log('⏰ Running automated Monday 9:00 AM Weekly Digest report audits...');
    try {
      const boards = await prisma.board.findMany({ select: { id: true } });
      for (const board of boards) {
        console.log(`Generating weekly digest report for board: ${board.id}`);
        await runWeeklyDigest(board.id);
      }
      console.log('Automated Weekly Digest reports audit completed.');
    } catch (error) {
      console.error('Error during scheduled Weekly Digest reports audits:', error);
    }
  });

  console.log('FlowMind background schedules active.');
}

export default router;
