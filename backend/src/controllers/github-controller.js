import prisma from '../db.js';
import { emitToBoard } from '../socket.js';

export async function importGithubIssues(req, res, next) {
  const { boardId } = req.params;
  const { repoUrl, userId } = req.body;

  if (!repoUrl || !userId) {
    return res.status(400).json({ error: 'repoUrl and userId are required' });
  }

  try {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let cleanUrl = repoUrl.trim().replace(/\/$/, "");
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      cleanUrl = cleanUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "");
    } else if (cleanUrl.startsWith("github.com/")) {
      cleanUrl = cleanUrl.replace(/^github\.com\//, "");
    }

    const parts = cleanUrl.split("/");
    if (parts.length < 2) {
      return res.status(400).json({ error: 'Invalid GitHub repository identifier. Use "owner/repo" format or full URL.' });
    }

    const owner = parts[0];
    const repo = parts[1];
    const repoUrlForIssue = `https://github.com/${owner}/${repo}`;

    const firstColumn = await prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: 'asc' }
    });

    if (!firstColumn) {
      return res.status(400).json({ error: 'Board has no columns to import issues into. Create a column first.' });
    }

    let page = 1;
    let totalImported = 0;
    let totalSkipped = 0;

    const lastCard = await prisma.card.findFirst({
      where: { columnId: firstColumn.id },
      orderBy: { position: 'desc' }
    });
    let cardPosition = lastCard ? lastCard.position + 1000.0 : 1000.0;

    const headers = {
      'User-Agent': 'FlowMind-App',
      'Accept': 'application/vnd.github.v3+json',
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    console.log(`Starting GitHub scraper for ${owner}/${repo} on board ${boardId}`);

    while (true) {
      const githubUrl = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`;
      const response = await fetch(githubUrl, { headers });

      if (!response.ok) {
        const errText = await response.text();
        console.error('GitHub API error response:', errText);
        return res.status(response.status).json({ 
          error: `Failed to fetch from GitHub API: ${response.statusText}`,
          details: errText 
        });
      }

      const issues = await response.json();

      if (!Array.isArray(issues) || issues.length === 0) {
        break;
      }

      for (const issue of issues) {
        if (issue.pull_request) {
          continue;
        }

        const existingCard = await prisma.card.findFirst({
          where: {
            githubIssueNumber: issue.number,
            githubRepoUrl: repoUrlForIssue,
            boardId
          }
        });

        if (existingCard) {
          totalSkipped++;
          continue;
        }

        const mappedLabelIds = [];
        if (issue.labels && Array.isArray(issue.labels)) {
          for (const ghLabel of issue.labels) {
            let dbLabel = await prisma.label.findFirst({
              where: { name: ghLabel.name, boardId }
            });

            if (!dbLabel) {
              dbLabel = await prisma.label.create({
                data: {
                  name: ghLabel.name,
                  color: ghLabel.color ? `#${ghLabel.color}` : '#6366f1',
                  boardId
                }
              });
            }
            mappedLabelIds.push(dbLabel.id);
          }
        }

        if (issue.assignees && Array.isArray(issue.assignees)) {
          for (const assignee of issue.assignees) {
            const assigneeEmail = `${assignee.login}@github.com`;
            let dbUser = await prisma.user.findUnique({ where: { email: assigneeEmail } });

            if (!dbUser) {
              await prisma.user.create({
                data: {
                  email: assigneeEmail,
                  name: assignee.login,
                }
              });
            }
          }
        }

        const newCard = await prisma.card.create({
          data: {
            title: `#${issue.number}: ${issue.title}`,
            description: issue.body || 'No description provided.',
            position: cardPosition,
            columnId: firstColumn.id,
            boardId,
            version: 0,
            githubIssueNumber: issue.number,
            githubRepoUrl: repoUrlForIssue,
            labels: {
              create: mappedLabelIds.map(labelId => ({
                label: { connect: { id: labelId } }
              }))
            }
          },
          include: {
            labels: {
              include: { label: true }
            }
          }
        });

        emitToBoard(boardId, 'card:created', newCard);

        cardPosition += 1000.0;
        totalImported++;
      }

      page++;
      if (page > 30) {
        break;
      }
    }

    if (totalImported > 0) {
      await prisma.activityLog.create({
        data: {
          boardId,
          userId,
          action: 'IMPORT_GITHUB',
          details: `Imported ${totalImported} issues from GitHub repository "${owner}/${repo}".`,
        }
      });
    }

    res.json({
      success: true,
      message: `Scraping completed. Imported ${totalImported} issues, skipped ${totalSkipped} duplicates.`,
      imported: totalImported,
      skipped: totalSkipped
    });

  } catch (error) {
    next(error);
  }
}
