import prisma from '../db.js';

export async function runWeeklyDigest(boardId) {
  console.log(`Starting Weekly Digest compilation for board: ${boardId}`);
  try {
    // 1. Fetch Board details including columns and cards
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
      throw new Error(`Board workspace ${boardId} not found.`);
    }

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    // 2. Query activity logs past 14 days
    const logs = await prisma.activityLog.findMany({
      where: {
        boardId,
        createdAt: { gte: fourteenDaysAgo }
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // Separate logs into this week vs last week
    const thisWeekLogs = logs.filter(log => new Date(log.createdAt) >= sevenDaysAgo);
    const lastWeekLogs = logs.filter(log => new Date(log.createdAt) < sevenDaysAgo);

    // Find the completed column (Done / final column)
    const sortedColumns = [...board.columns].sort((a, b) => a.position - b.position);
    const doneColumn = sortedColumns[sortedColumns.length - 1];

    let completedThisWeek = 0;
    let completedLastWeek = 0;
    const assigneeCompletions = {};

    if (doneColumn) {
      // Completed this week: logs in past 7 days moving/creating in Done column
      thisWeekLogs.forEach(log => {
        try {
          const data = JSON.parse(log.details);
          if (data.targetColumnId === doneColumn.id && (data.actionType === 'MOVE' || data.actionType === 'CREATE')) {
            completedThisWeek++;
            // Try to map to assignee
            if (log.cardId) {
              // Find card assignee in active board columns
              for (const col of board.columns) {
                const card = col.cards.find(c => c.id === log.cardId);
                if (card && card.assignee) {
                  const name = card.assignee.name || card.assignee.email.split('@')[0];
                  assigneeCompletions[name] = (assigneeCompletions[name] || 0) + 1;
                  break;
                }
              }
            }
          }
        } catch (e) {
          const lowerDetails = log.details.toLowerCase();
          if (lowerDetails.includes(`to "${doneColumn.name.toLowerCase()}"`) || lowerDetails.includes(`in column "${doneColumn.name.toLowerCase()}"`)) {
            completedThisWeek++;
          }
        }
      });

      // Completed last week: logs between 7-14 days ago moving/creating in Done column
      lastWeekLogs.forEach(log => {
        try {
          const data = JSON.parse(log.details);
          if (data.targetColumnId === doneColumn.id && (data.actionType === 'MOVE' || data.actionType === 'CREATE')) {
            completedLastWeek++;
          }
        } catch (e) {
          const lowerDetails = log.details.toLowerCase();
          if (lowerDetails.includes(`to "${doneColumn.name.toLowerCase()}"`) || lowerDetails.includes(`in column "${doneColumn.name.toLowerCase()}"`)) {
            completedLastWeek++;
          }
        }
      });
    }

    // Velocity trend calculation
    let velocityTrend = "0%";
    if (completedLastWeek > 0) {
      const pct = ((completedThisWeek - completedLastWeek) / completedLastWeek) * 100;
      velocityTrend = `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
    } else if (completedThisWeek > 0) {
      velocityTrend = `+100%`;
    }

    // Bottlenecks in past 7 days
    const columnMetrics = {};
    board.columns.forEach(col => {
      columnMetrics[col.id] = { name: col.name, entered: 0, left: 0 };
    });

    thisWeekLogs.forEach(log => {
      try {
        const data = JSON.parse(log.details);
        if (data.targetColumnId && columnMetrics[data.targetColumnId]) {
          columnMetrics[data.targetColumnId].entered++;
        }
        if (data.sourceColumnId && columnMetrics[data.sourceColumnId]) {
          columnMetrics[data.sourceColumnId].left++;
        }
      } catch (e) {
        // text logs fallback
      }
    });

    let topBottleneckColumn = "None";
    let maxRatio = 1.0;
    board.columns.forEach(col => {
      const metrics = columnMetrics[col.id];
      const leftCount = metrics.left || 0.5;
      const ratio = metrics.entered / leftCount;
      if (ratio > maxRatio && metrics.entered > 0) {
        maxRatio = ratio;
        topBottleneckColumn = col.name;
      }
    });

    // Format assignee completion rates
    const completionRates = Object.entries(assigneeCompletions)
      .map(([name, count]) => `- **${name}**: Completed ${count} tasks this week.`)
      .join('\n') || "- No assignees registered task completions this week.";

    // 3. Prompt Groq for weekly narrative
    const contextPrompt = `
You are the AI Project Manager. Summarize the weekly sprint velocity trends for board: "${board.name}".
Sprint Range: ${sevenDaysAgo.toLocaleDateString()} to ${now.toLocaleDateString()}

--- WEEKLY LOGS PERFORMANCE METRICS ---
- Completed Tasks This Week: ${completedThisWeek} cards
- Completed Tasks Last Week: ${completedLastWeek} cards
- Task Completion Velocity Trend: ${velocityTrend}
- Top Congestion Bottleneck Column: "${topBottleneckColumn}"

--- TEAM TASK COMPLETION RATES ---
${completionRates}

Write a professional narrative Weekly Digest Report in Markdown format:
- **Velocity Trends Summary**: Discuss the rate of task resolutions this week compared to last week. Call out the velocity trend percentage explicitly.
- **Congestion Analysis**: Address the bottlenecks, stating how congestion in "${topBottleneckColumn}" is impacting workflow speeds.
- **Assignee Highlights**: Acknowledge the top performers based on the completed cards metrics.
- **Next Week Priorities**: Recommend 2-3 specific task priorities or unblocking items to optimize next week's velocity.
    `;

    let digestContent = '';
    const apiKey = process.env.GROQ_API_KEY;

    if (apiKey) {
      try {
        console.log('Fetching weekly digest narrative from Groq API...');
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b',
            messages: [
              { 
                role: 'system', 
                content: 'You are FlowMind AI Project Manager. Compile a professional executive weekly digest report in markdown based on the provided metrics context.' 
              },
              { role: 'user', content: contextPrompt }
            ],
            temperature: 0.3
          })
        });

        if (response.ok) {
          const result = await response.json();
          digestContent = result.choices[0].message.content;
          console.log('Weekly digest generated via Groq API.');
        } else {
          console.error('Groq API Error details:', await response.text());
        }
      } catch (err) {
        console.error('Groq digest compilation connection failed:', err);
      }
    }

    if (!digestContent) {
      // Mock Fallback builder
      console.log('Using mock digest generator fallback.');
      digestContent = `
### Weekly Digest Report — ${board.name}
**Date Range:** ${sevenDaysAgo.toLocaleDateString()} – ${now.toLocaleDateString()}

#### 📈 Velocity & Completion trends
This week, the team completed **${completedThisWeek} tasks**, compared to **${completedLastWeek} tasks** last week. This represents a velocity shift of **${velocityTrend}**. Workflow activity indicates consistent execution speeds.

#### ⚠️ Congestion bottlenecks
Our bottleneck analyzer flagged the column **"${topBottleneckColumn}"** as the primary congestion area this week. Work item entries outpaced output, suggesting backlog review or quality assurance delays.

#### 👥 Team Productivity Highlights
Individual completion breakdown:
${completionRates}

#### 🎯 Next Week Recommendations
1. **Clear bottleneck lanes:** Dedicate resources to resolve blocked tickets in the "${topBottleneckColumn}" column.
2. **Review assignee capacities:** Reassign backlog cards to balance tasks before next week's planning.
      `;
    }

    // 4. Save to DigestReport table
    const weeklyReport = await prisma.digestReport.create({
      data: {
        boardId,
        title: `Weekly Digest - ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
        content: digestContent,
        startDate: sevenDaysAgo,
        endDate: now
      }
    });

    console.log(`Saved DigestReport to DB: ${weeklyReport.id}`);
    return weeklyReport;

  } catch (error) {
    console.error('Failed generating weekly digest:', error);
    throw error;
  }
}
