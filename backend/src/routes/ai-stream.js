import express from 'express';
import Redis from 'ioredis';

const router = express.Router();

// GET /api/boards/:id/ai-stream
router.get('/:id/ai-stream', (req, res) => {
  const boardId = req.params.id;

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Bypass proxy buffering (e.g. Nginx)
  });

  // Initial comment to establish connection
  res.write(':\n\n');

  // Instantiate separate Redis client for subscription channel
  const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const channel = `board:${boardId}:ai-stream`;

  console.log(`SSE Client connected to AI Stream for channel: ${channel}`);

  redisSub.subscribe(channel, (err, count) => {
    if (err) {
      console.error(`Redis Subscription failed for channel ${channel}:`, err);
      res.write(`data: ${JSON.stringify({ error: 'Connection to Pub/Sub adapter failed.' })}\n\n`);
      res.end();
      return;
    }
    console.log(`Successfully subscribed to AI Stream adapter on channel: ${channel}`);
  });

  redisSub.on('message', (chan, message) => {
    if (chan === channel) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.token === '[DONE]') {
          res.write('data: [DONE]\n\n');
          redisSub.unsubscribe();
          redisSub.quit();
          res.end();
          console.log(`AI stream finished for channel: ${channel}`);
        } else {
          res.write(`data: ${JSON.stringify({ token: parsed.token })}\n\n`);
        }
      } catch (error) {
        console.error('Error parsing Redis PubSub message:', error);
      }
    }
  });

  // Cleanup on client close
  req.on('close', () => {
    console.log(`SSE Client disconnected from AI Stream: ${channel}`);
    redisSub.unsubscribe();
    redisSub.quit();
  });
});

export default router;
