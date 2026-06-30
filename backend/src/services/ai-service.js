import Redis from 'ioredis';
import prisma from '../db.js';

const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisPub.on('error', (err) => {
  console.error('Redis redisPub client error in ai-service:', err.message);
});

export async function runAiAnalysis(boardId) {
  const channel = `board:${boardId}:ai-stream`;
  console.log(`Starting AI analysis stream on Redis channel: ${channel}`);

  const publishToken = (token) => {
    redisPub.publish(channel, JSON.stringify({ token }));
  };

  try {
    // 1. Fetch Board details including columns and card assignees
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          include: {
            cards: {
              include: {
                assignee: true,
                labels: { include: { label: true } }
              }
            }
          }
        }
      }
    });

    if (!board) {
      publishToken("Error: Board workspace not found.");
      publishToken("[DONE]");
      return;
    }

    // 2. Fetch past 7 days activity logs
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await prisma.activityLog.findMany({
      where: {
        boardId,
        createdAt: { gte: sevenDaysAgo }
      }
    });

    // 3. Compute bottleneck enter/leave counts for columns
    const columnMetrics = {};
    board.columns.forEach(col => {
      columnMetrics[col.id] = { name: col.name, entered: 0, left: 0 };
    });

    logs.forEach(log => {
      try {
        const data = JSON.parse(log.details);
        if (data.targetColumnId && columnMetrics[data.targetColumnId]) {
          columnMetrics[data.targetColumnId].entered++;
        }
        if (data.sourceColumnId && columnMetrics[data.sourceColumnId]) {
          columnMetrics[data.sourceColumnId].left++;
        }
      } catch (e) {
        // Fallback for older raw text logs if JSON parsing fails
        const lowerDetails = log.details.toLowerCase();
        board.columns.forEach(col => {
          const colNameLower = col.name.toLowerCase();
          if (log.action === 'CREATE_CARD' && lowerDetails.includes(colNameLower)) {
            columnMetrics[col.id].entered++;
          } else if (log.action === 'MOVE_CARD') {
            if (lowerDetails.includes(`to "${colNameLower}"`) || lowerDetails.includes(`to column "${colNameLower}"`)) {
              columnMetrics[col.id].entered++;
            }
            if (lowerDetails.includes(`from "${colNameLower}"`) || lowerDetails.includes(`from column "${colNameLower}"`)) {
              columnMetrics[col.id].left++;
            }
          }
        });
      }
    });

    // Flag bottleneck columns: entered > left * 1.5 AND entered > 0
    const bottleneckColumns = [];
    board.columns.forEach(col => {
      const metrics = columnMetrics[col.id];
      const leftCount = metrics.left || 0.5; // default to 0.5 to avoid division by zero
      if (metrics.entered > leftCount * 1.5 && metrics.entered > 0) {
        bottleneckColumns.push(col);
      }
    });

    // Calculate velocity (cards completed per day over past 7 days)
    // Completed column is the last column by position
    const sortedColumns = [...board.columns].sort((a, b) => a.position - b.position);
    const doneColumn = sortedColumns[sortedColumns.length - 1];
    
    let completedCardsCount = 0;
    if (doneColumn) {
      // Find cards moved or created in Done column in past 7 days
      completedCardsCount = logs.filter(log => {
        try {
          const data = JSON.parse(log.details);
          return data.targetColumnId === doneColumn.id && (data.actionType === 'MOVE' || data.actionType === 'CREATE');
        } catch (e) {
          const lowerDetails = log.details.toLowerCase();
          return lowerDetails.includes(`to "${doneColumn.name.toLowerCase()}"`) || lowerDetails.includes(`in column "${doneColumn.name.toLowerCase()}"`);
        }
      }).length;
    }
    const velocity = completedCardsCount / 7.0; // cards completed per day

    // Cards remaining: sum of cards in all columns EXCEPT the Done column
    let remainingCardsCount = 0;
    sortedColumns.slice(0, -1).forEach(col => {
      remainingCardsCount += col.cards.length;
    });

    // Sprint details
    const daysRemaining = 7; // assume default 7 days remaining
    const requiredVelocity = daysRemaining > 0 ? remainingCardsCount / daysRemaining : remainingCardsCount;
    const isAtRisk = velocity < requiredVelocity;

    // 4. Construct prompt context
    const bottleneckSummary = bottleneckColumns.map(col => {
      // Top assignee and label in this bottleneck column
      const assigneesFreq = {};
      const labelsFreq = {};
      
      col.cards.forEach(card => {
        if (card.assignee) {
          const assigneeName = card.assignee.name || card.assignee.email;
          assigneesFreq[assigneeName] = (assigneesFreq[assigneeName] || 0) + 1;
        }
        card.labels.forEach(cl => {
          labelsFreq[cl.label.name] = (labelsFreq[cl.label.name] || 0) + 1;
        });
      });

      const topAssignee = Object.keys(assigneesFreq).sort((a, b) => assigneesFreq[b] - assigneesFreq[a])[0] || 'Unassigned';
      const topLabel = Object.keys(labelsFreq).sort((a, b) => labelsFreq[b] - labelsFreq[a])[0] || 'None';

      return `- Column **"${col.name}"** is experiencing high congestion (Entered past 7 days: ${columnMetrics[col.id].entered}, Left: ${columnMetrics[col.id].left}). Top assignee holding cards is **${topAssignee}**, and most cards carry the label **"${topLabel}"**.`;
    }).join('\n');

    const contextPrompt = `
You are the AI Project Manager for the FlowMind collaborative workspace board. Prepare a concise executive project status summary:
Board: "${board.name}"

--- BOTTLENECK ANALYSIS (Past 7 Days Metrics) ---
${bottleneckSummary || "No columns flagged as a bottleneck. Workflow traffic is balanced."}

--- SPRINT RISK ASSESSMENT ---
- Team Velocity: ${velocity.toFixed(2)} completed cards/day
- Remaining Active Cards: ${remainingCardsCount}
- Sprint Days Remaining: ${daysRemaining} days
- Required Velocity to Hit Goal: ${requiredVelocity.toFixed(2)} cards/day
- Estimated Goal Risk: ${isAtRisk ? 'HIGH RISK OF DELAY' : 'LOW RISK / ON TRACK'}

Write a narrative summary in clean markdown format:
1. **Bottleneck Report**: Plain-English evaluation of flagged lanes, explaining why they are backing up and highlighting top assignee/label weights.
2. **Sprint Risk Narrative**: Direct evaluation of completion velocity ratios, stating whether the team will hit goals.
3. **Actionable Recommendations**: Provide 2-3 specific recommendations (like unblocking cards, pair programming, or adjusting assignees) to increase velocity.
    `;

    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      console.log('Requesting Groq streaming completions...');
      const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: 'You are FlowMind AI Project Manager. Summarize board bottlenecks and sprint risk velocity metrics. Respond in concise markdown format.' 
            },
            { role: 'user', content: contextPrompt }
          ],
          stream: true,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Groq streaming initiation failed:', errText);
        throw new Error(`Groq returned ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: [DONE]')) {
            break;
          }
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              const token = parsed.choices[0].delta.content || '';
              if (token) {
                publishToken(token);
                fullContent += token;
              }
            } catch (err) {
              // ignore parse errors on partial streams
            }
          }
        }
      }

      // Save analysis insight text to DB
      await prisma.aIInsight.create({
        data: {
          boardId,
          type: 'BOTTLENECK',
          content: fullContent
        }
      });

      publishToken('[DONE]');
      console.log('AI stream completed and insight saved.');

    } else {
      // Mock Fallback streaming output
      console.log('No GROQ_API_KEY set. Streaming mock analysis.');
      
      const mockParagraphs = [
        `### AI Board Executive Summary\n\n`,
        `**1. Bottleneck Report:**\n`,
        bottleneckColumns.length > 0
          ? `${bottleneckSummary}\nWe detect congestion in these columns. High volumes of incoming tasks compared to resolved tickets indicates a review delay or task blockages.\n\n`
          : `Great news! No columns are currently flagged as bottlenecks. Work is flowing steadily across all board columns.\n\n`,
        `**2. Sprint Risk Assessment:**\n`,
        `The team is completing cards at **${velocity.toFixed(2)} completed cards/day**. With **${remainingCardsCount} active tasks remaining** and **${daysRemaining} days left** in the sprint, our required speed is **${requiredVelocity.toFixed(2)} cards/day**. `,
        isAtRisk
          ? `We are currently at **HIGH RISK** of missing the target. We need to boost velocity. `
          : `We are on track (**LOW RISK**) to complete all cards on schedule. `,
        `Workflow speed analysis indicates we should prioritize clearing In Progress work and check on assignee load balancing.\n\n`,
        `**3. Actionable Recommendations:**\n`,
        `- **Focus on Unblocking:** Reassign blocked cards in bottleneck columns to devs with spare bandwidth.\n`,
        `- **Pair Programming:** Deploy pair-programming on complex tasks (e.g., cards with complexity 4 or 5).\n`,
        `- **Capacity Adjustments:** Move lower-priority cards out of the active column back to the Backlog.`
      ];

      // Stream words recursively with minor delays
      let accumulatedText = "";
      for (const para of mockParagraphs) {
        const words = para.split(" ");
        for (const word of words) {
          const token = word + " ";
          publishToken(token);
          accumulatedText += token;
          await new Promise(resolve => setTimeout(resolve, 35));
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Save insight to DB
      await prisma.aIInsight.create({
        data: {
          boardId,
          type: 'BOTTLENECK',
          content: accumulatedText
        }
      });

      publishToken('[DONE]');
      console.log('Mock AI stream completed and insight saved.');
    }

  } catch (error) {
    console.error('Error during AI analysis stream generation:', error);
    publishToken(`Error: AI Project Manager encountered an error during computation: ${error.message}`);
    publishToken('[DONE]');
  }
}
