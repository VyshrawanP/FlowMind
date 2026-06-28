import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'vyshrawanp@example.com' },
    update: {},
    create: {
      email: 'vyshrawanp@example.com',
      name: 'Vyshrawan P',
      passwordHash: '$2b$12$K.dCOF8wJlyN/n0C9JdG3.K41P.mR2.gX1N81tO.o.D6a2lXQ.Dpq', // Hashed value of "password"
      role: 'ADMIN',
      isVerified: true,
    },
  });

  console.log(`Default user created/found: ${user.name} (${user.id})`);

  // Create a default board if none exists
  let board = await prisma.board.findFirst();

  if (!board) {
    board = await prisma.board.create({
      data: {
        name: 'My Workspace Board',
        description: 'FlowMind collaborative Kanban board with AI Insights',
        ownerId: user.id,
      },
    });
    console.log(`Created default board: ${board.name} (${board.id})`);
  } else {
    console.log(`Using existing board: ${board.name} (${board.id})`);
  }

  // Create columns if board has no columns
  const columnsCount = await prisma.column.count({
    where: { boardId: board.id },
  });

  let columns = [];
  if (columnsCount === 0) {
    columns = [
      await prisma.column.create({ data: { name: 'To Do', position: 1000.0, boardId: board.id } }),
      await prisma.column.create({ data: { name: 'In Progress', position: 2000.0, boardId: board.id } }),
      await prisma.column.create({ data: { name: 'Done', position: 3000.0, boardId: board.id } }),
    ];
    console.log('Created default columns (To Do, In Progress, Done).');
  } else {
    columns = await prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: { position: 'asc' },
    });
    console.log('Using existing columns.');
  }

  // Create labels if none exist
  const labelsCount = await prisma.label.count({
    where: { boardId: board.id },
  });

  let labels = [];
  if (labelsCount === 0) {
    labels = [
      await prisma.label.create({ data: { name: 'Feature', color: '#3b82f6', boardId: board.id } }),
      await prisma.label.create({ data: { name: 'Bug', color: '#ef4444', boardId: board.id } }),
      await prisma.label.create({ data: { name: 'Refactor', color: '#10b981', boardId: board.id } }),
      await prisma.label.create({ data: { name: 'High Priority', color: '#f59e0b', boardId: board.id } }),
    ];
    console.log('Created default labels.');
  } else {
    labels = await prisma.label.findMany({
      where: { boardId: board.id },
    });
    console.log('Using existing labels.');
  }

  // Create default cards if columns have no cards
  const cardsCount = await prisma.card.count({
    where: { boardId: board.id },
  });

  if (cardsCount === 0 && columns.length > 0) {
    const todoCol = columns[0];
    const inProgressCol = columns[1];
    const doneCol = columns[2];

    // Card 1
    const card1 = await prisma.card.create({
      data: {
        title: 'Design Prisma database models',
        description: 'Create models for users, boards, columns, cards, labels, activity log and comments.',
        position: 1000.0,
        columnId: todoCol.id,
        boardId: board.id,
        version: 0,
        labels: {
          create: [
            { label: { connect: { id: labels[0].id } } },
            { label: { connect: { id: labels[3].id } } },
          ],
        },
      },
    });

    // Card 2
    const card2 = await prisma.card.create({
      data: {
        title: 'Setup Socket.io with Redis adapter',
        description: 'Configure real-time server with failover to local memory if Redis is down.',
        position: 2000.0,
        columnId: inProgressCol.id,
        boardId: board.id,
        version: 0,
        labels: {
          create: [
            { label: { connect: { id: labels[0].id } } },
          ],
        },
      },
    });

    // Card 3
    const card3 = await prisma.card.create({
      data: {
        title: 'Initialize repository structure',
        description: 'Setup backend and frontend subfolders with package.json configuration.',
        position: 1000.0,
        columnId: doneCol.id,
        boardId: board.id,
        version: 0,
        labels: {
          create: [
            { label: { connect: { id: labels[2].id } } },
          ],
        },
      },
    });

    // Seed activity logs
    await prisma.activityLog.createMany({
      data: [
        { boardId: board.id, userId: user.id, action: 'CREATE_CARD', details: `Card "${card1.title}" created in column "${todoCol.name}".` },
        { boardId: board.id, userId: user.id, action: 'CREATE_CARD', details: `Card "${card2.title}" created in column "${inProgressCol.name}".` },
        { boardId: board.id, userId: user.id, action: 'CREATE_CARD', details: `Card "${card3.title}" created in column "${doneCol.name}".` },
      ],
    });

    console.log('Seeded cards and activity logs.');
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
