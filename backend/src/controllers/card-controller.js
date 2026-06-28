import prisma from '../db.js';
import { emitToBoard } from '../socket.js';

export async function getCards(req, res, next) {
  const { columnId } = req.query;
  if (!columnId) {
    return res.status(400).json({ error: 'columnId query parameter is required' });
  }
  try {
    const cards = await prisma.card.findMany({
      where: { columnId },
      orderBy: { position: 'asc' },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        assignee: {
          select: { id: true, name: true, email: true }
        }
      },
    });
    res.json(cards);
  } catch (error) {
    next(error);
  }
}

export async function inferCardComplexity(req, res, next) {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      console.log(`Calling Groq API for complexity inference on task: "${title}"`);
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
              content: 'You are an expert project manager. You must evaluate the complexity of a task based on its title and description on a 1-5 scale. You must respond strictly in JSON format with the keys "complexity" (integer 1-5) and "reasoning" (short, concise explanation of 1-2 sentences).'
            },
            {
              role: 'user',
              content: `Task Title: "${title}"\nTask Description: "${description || ''}"`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const result = await response.json();
        const jsonContent = JSON.parse(result.choices[0].message.content);
        return res.json({
          complexity: jsonContent.complexity,
          reasoning: jsonContent.reasoning
        });
      } else {
        const errText = await response.text();
        console.error('Groq API Error Response:', errText);
      }
    } catch (e) {
      console.error('Failed calling Groq API:', e);
    }
  }

  // Fallback Mock Complexity inference if Groq fails or API key is not present
  console.log('Using mock fallback for complexity inference.');
  let inferredComplexity = 3;
  let reasoning = "Determined complexity estimation based on description length.";
  
  if (description) {
    const descLower = description.toLowerCase();
    if (descLower.includes("setup") || descLower.includes("initialize") || descLower.includes("repo")) {
      inferredComplexity = 2;
      reasoning = "Setting up initial repositories or skeletons is generally straightforward with standardized templates.";
    } else if (descLower.includes("database") || descLower.includes("model") || descLower.includes("schema")) {
      inferredComplexity = 3;
      reasoning = "Designing schemas requires database normalization understanding and relationships linking.";
    } else if (descLower.includes("cron") || descLower.includes("background") || descLower.includes("groq") || descLower.includes("redis")) {
      inferredComplexity = 4;
      reasoning = "Configuring background schedulers and cache adapters involves concurrency controls and stream parsing.";
    } else if (description.length < 20) {
      inferredComplexity = 1;
      reasoning = "Task description is brief, indicating a straightforward or trivial execution effort.";
    } else if (description.length > 200) {
      inferredComplexity = 5;
      reasoning = "Description lists extensive requirements, likely spanning multiple integrations or state operations.";
    }
  } else {
    inferredComplexity = 1;
    reasoning = "No description provided, suggesting a low complexity task.";
  }

  return res.json({ complexity: inferredComplexity, reasoning });
}

export async function createCard(req, res, next) {
  const { title, description, position, columnId, boardId, userId, labelIds, complexity, complexityReason, assigneeId } = req.body;
  if (!title || position === undefined || !columnId || !boardId || !userId) {
    return res.status(400).json({ error: 'title, position, columnId, boardId, and userId are required' });
  }

  try {
    const card = await prisma.card.create({
      data: {
        title,
        description,
        position: parseFloat(position),
        columnId,
        boardId,
        version: 0,
        complexity: complexity !== undefined && complexity !== null ? parseInt(complexity) : undefined,
        complexityReason,
        assigneeId: assigneeId || undefined,
        labels: labelIds && labelIds.length > 0 ? {
          create: labelIds.map(labelId => ({
            label: { connect: { id: labelId } }
          }))
        } : undefined,
      },
      include: {
        labels: {
          include: { label: true }
        },
        assignee: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const logDetails = JSON.stringify({
      text: `Card "${title}" was created in column.`,
      targetColumnId: columnId,
      actionType: 'CREATE'
    });

    await prisma.activityLog.create({
      data: {
        boardId,
        cardId: card.id,
        userId,
        action: 'CREATE_CARD',
        details: logDetails,
      },
    });

    emitToBoard(boardId, 'card:created', card);
    res.status(201).json(card);
  } catch (error) {
    next(error);
  }
}

export async function updateCard(req, res, next) {
  const { id } = req.params;
  const { title, description, position, columnId, version, userId, labelIds, complexity, complexityReason, assigneeId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const existingCard = await prisma.card.findUnique({
      where: { id },
      include: { labels: true }
    });

    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Conflict check
    if (version !== undefined && existingCard.version > version) {
      console.log(`Conflict detected for card ${id}. Client version: ${version}, DB version: ${existingCard.version}`);
      return res.status(409).json({
        error: 'Conflict detected',
        message: 'Conflict detected. Latest version kept.',
        card: existingCard,
      });
    }

    const isMoved = (columnId !== undefined && columnId !== existingCard.columnId) || 
                    (position !== undefined && parseFloat(position) !== existingCard.position);

    const updateData = {
      version: { increment: 1 },
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (position !== undefined) updateData.position = parseFloat(position);
    if (columnId !== undefined) updateData.columnId = columnId;
    if (complexity !== undefined) updateData.complexity = complexity !== null ? parseInt(complexity) : null;
    if (complexityReason !== undefined) updateData.complexityReason = complexityReason;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    if (labelIds !== undefined) {
      await prisma.cardLabel.deleteMany({ where: { cardId: id } });
      if (labelIds.length > 0) {
        updateData.labels = {
          create: labelIds.map(labelId => ({
            label: { connect: { id: labelId } }
          }))
        };
      }
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: updateData,
      include: {
        labels: {
          include: { label: true }
        },
        assignee: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const fromColId = existingCard.columnId;
    const toColId = updatedCard.columnId;
    let logText = `Card "${updatedCard.title}" was updated.`;
    
    if (isMoved) {
      const fromColumn = await prisma.column.findUnique({ where: { id: fromColId } });
      const toColumn = await prisma.column.findUnique({ where: { id: toColId } });
      logText = `Card "${updatedCard.title}" moved from column "${fromColumn?.name || 'Unknown'}" to "${toColumn?.name || 'Unknown'}".`;
    }

    const logDetails = JSON.stringify({
      text: logText,
      sourceColumnId: fromColId,
      targetColumnId: toColId,
      actionType: isMoved ? 'MOVE' : 'UPDATE'
    });

    await prisma.activityLog.create({
      data: {
        boardId: updatedCard.boardId,
        cardId: updatedCard.id,
        userId,
        action: isMoved ? 'MOVE_CARD' : 'UPDATE_CARD',
        details: logDetails,
      },
    });

    const eventName = isMoved ? 'card:moved' : 'card:updated';
    emitToBoard(updatedCard.boardId, eventName, updatedCard);
    res.json(updatedCard);
  } catch (error) {
    next(error);
  }
}

export async function deleteCard(req, res, next) {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required for tracking' });
  }

  try {
    const card = await prisma.card.findUnique({ where: { id } });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await prisma.card.delete({ where: { id } });

    const logDetails = JSON.stringify({
      text: `Card "${card.title}" was deleted.`,
      sourceColumnId: card.columnId,
      actionType: 'DELETE'
    });

    await prisma.activityLog.create({
      data: {
        boardId: card.boardId,
        userId: String(userId),
        action: 'DELETE_CARD',
        details: logDetails,
      },
    });

    emitToBoard(card.boardId, 'card:deleted', {
      cardId: id,
      boardId: card.boardId,
      columnId: card.columnId,
    });

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    next(error);
  }
}
