import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Enterprise Board Seeding...');

  // 1. Clean existing data (except users to prevent lockouts)
  await prisma.activityLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.column.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.board.deleteMany({});

  // 2. Create / Upsert Default Administrator
  const adminUser = await prisma.user.upsert({
    where: { email: 'vyshrawanp@example.com' },
    update: { isVerified: true },
    create: {
      email: 'vyshrawanp@example.com',
      name: 'Vyshrawan P (Lead PM)',
      passwordHash: '$2b$12$K.dCOF8wJlyN/n0C9JdG3.K41P.mR2.gX1N81tO.o.D6a2lXQ.Dpq', // password
      role: 'ADMIN',
      isVerified: true,
    },
  });

  // 3. Create Team Members (Simulated)
  const teamMembers = [
    await prisma.user.upsert({
      where: { email: 'alex.mercer@flowmind.com' },
      update: { isVerified: true },
      create: {
        email: 'alex.mercer@flowmind.com',
        name: 'Alex Mercer (Backend Lead)',
        passwordHash: '$2b$12$K.dCOF8wJlyN/n0C9JdG3.K41P.mR2.gX1N81tO.o.D6a2lXQ.Dpq',
        role: 'USER',
        isVerified: true,
      }
    }),
    await prisma.user.upsert({
      where: { email: 'sarah.chen@flowmind.com' },
      update: { isVerified: true },
      create: {
        email: 'sarah.chen@flowmind.com',
        name: 'Sarah Chen (Senior SRE)',
        passwordHash: '$2b$12$K.dCOF8wJlyN/n0C9JdG3.K41P.mR2.gX1N81tO.o.D6a2lXQ.Dpq',
        role: 'USER',
        isVerified: true,
      }
    }),
    await prisma.user.upsert({
      where: { email: 'devon.cole@flowmind.com' },
      update: { isVerified: true },
      create: {
        email: 'devon.cole@flowmind.com',
        name: 'Devon Cole (Frontend Architect)',
        passwordHash: '$2b$12$K.dCOF8wJlyN/n0C9JdG3.K41P.mR2.gX1N81tO.o.D6a2lXQ.Dpq',
        role: 'USER',
        isVerified: true,
      }
    })
  ];

  console.log('✅ Admin and team members configured.');

  // 4. Create Board
  const board = await prisma.board.create({
    data: {
      name: 'FlowMind Core Sprint Workspace',
      description: 'Sprint 24: Core WebSocket optimizations, AI telemetry modeling, and rate-limiting middleware rollout.',
      ownerId: adminUser.id,
    },
  });

  // 5. Create Enterprise Agile Columns
  const backlog = await prisma.column.create({ data: { name: 'Backlog', position: 1000, boardId: board.id } });
  const todo = await prisma.column.create({ data: { name: 'To Do', position: 2000, boardId: board.id } });
  const inProgress = await prisma.column.create({ data: { name: 'In Progress', position: 3000, boardId: board.id } });
  const underReview = await prisma.column.create({ data: { name: 'Under Review', position: 4000, boardId: board.id } });
  const done = await prisma.column.create({ data: { name: 'Done', position: 5000, boardId: board.id } });

  console.log('✅ Agile Kanban columns initialized.');

  // 6. Create Labels
  const labels = [
    await prisma.label.create({ data: { name: 'Feature', color: '#6366f1', boardId: board.id } }),
    await prisma.label.create({ data: { name: 'Bug', color: '#ef4444', boardId: board.id } }),
    await prisma.label.create({ data: { name: 'Refactor', color: '#10b981', boardId: board.id } }),
    await prisma.label.create({ data: { name: 'Security', color: '#a855f7', boardId: board.id } }),
    await prisma.label.create({ data: { name: 'High Priority', color: '#f59e0b', boardId: board.id } }),
  ];

  console.log('✅ Color-coded tags generated.');

  // 7. Seed Strategic Cards to simulate an overloaded backlog/progress column
  
  // Tasks assigned to Alex in Progress (Simulates Bottleneck)
  const task1 = await prisma.card.create({
    data: {
      title: 'feat: Implement secure JWT rotation and token blacklist schema',
      description: 'Design and deploy database-backed JWT rotation schemas to expire stale tokens instantly. Link with sliding window expiry checks.',
      position: 1000,
      columnId: inProgress.id,
      boardId: board.id,
      complexity: 5,
      complexityReason: 'Requires database model extensions, token cache invalidation, and custom JWT payload signing.',
      assigneeId: teamMembers[0].id, // Alex
      labels: { create: [{ label: { connect: { id: labels[0].id } } }, { label: { connect: { id: labels[3].id } } }] }
    }
  });

  const task2 = await prisma.card.create({
    data: {
      title: 'perf: Optimize Prisma raw query indexes on user activity metrics',
      description: 'Analyze telemetry logs. Build SQL indexes on activity log timestamp fields to optimize board load speeds.',
      position: 2000,
      columnId: inProgress.id,
      boardId: board.id,
      complexity: 3,
      complexityReason: 'Relies on raw PostgreSQL database commands and index verification scripts.',
      assigneeId: teamMembers[0].id, // Alex
      labels: { create: [{ label: { connect: { id: labels[2].id } } }] }
    }
  });

  const task3 = await prisma.card.create({
    data: {
      title: 'sec: Setup Rate-Limiter DDoS middleware via Redis window sliding',
      description: 'Protect signup and login routes using redis-backed sliding window rate limiters. Bypasses proxy requests cleanly.',
      position: 3000,
      columnId: inProgress.id,
      boardId: board.id,
      complexity: 5,
      complexityReason: 'Requires configuring Redis client adapters and handling X-Forwarded-For HTTP proxy headers.',
      assigneeId: teamMembers[0].id, // Alex
      labels: { create: [{ label: { connect: { id: labels[3].id } } }, { label: { connect: { id: labels[4].id } } }] }
    }
  });

  // Task for Sarah
  const task4 = await prisma.card.create({
    data: {
      title: 'refactor: Migrate Redis cluster key-slot mappings for horizontal scaling',
      description: 'Prepare Redis caches for scale. Shift standard pub/sub mappings into localized slots to bypass single-thread caps.',
      position: 1000,
      columnId: inProgress.id,
      boardId: board.id,
      complexity: 8,
      complexityReason: 'Extremely high SRE scaling impact. Involves cluster partitioning.',
      assigneeId: teamMembers[1].id, // Sarah
      labels: { create: [{ label: { connect: { id: labels[2].id } } }, { label: { connect: { id: labels[4].id } } }] }
    }
  });

  // Tasks in Todo
  await prisma.card.create({
    data: {
      title: 'infra: Configure multi-stage Docker build cache in Railway',
      description: 'Minimize build compile times from 5 minutes to 40 seconds by leveraging intermediate cache layer strategies.',
      position: 1000,
      columnId: todo.id,
      boardId: board.id,
      complexity: 3,
      complexityReason: 'Requires edits to local Dockerfile commands and dependency caching blocks.',
      assigneeId: teamMembers[1].id, // Sarah
      labels: { create: [{ label: { connect: { id: labels[2].id } } }] }
    }
  });

  // Tasks in Under Review
  await prisma.card.create({
    data: {
      title: 'feat: Build dynamic WebSocket event broadcaster in client workspace',
      description: 'Bridge socket.io client nodes. Broadcast card updates as JSON payloads immediately as user completes drag actions.',
      position: 1000,
      columnId: underReview.id,
      boardId: board.id,
      complexity: 5,
      complexityReason: 'Highly dependent on multi-client WebSocket synchronization and UI snap-backs.',
      assigneeId: teamMembers[2].id, // Devon
      labels: { create: [{ label: { connect: { id: labels[0].id } } }] }
    }
  });

  // Tasks in Done
  await prisma.card.create({
    data: {
      title: 'design: Create glassmorphism design variables in vanilla CSS system',
      description: 'Build central stylesheet with modern theme variables, gradients, and custom scroll bars.',
      position: 1000,
      columnId: done.id,
      boardId: board.id,
      complexity: 2,
      complexityReason: 'Purely style-focused. Zero data impact.',
      assigneeId: teamMembers[2].id, // Devon
      labels: { create: [{ label: { connect: { id: labels[0].id } } }] }
    }
  });

  // 8. Create Activity Logs Audit history
  await prisma.activityLog.createMany({
    data: [
      { boardId: board.id, userId: adminUser.id, action: 'CREATE_BOARD', details: `Sprint board "${board.name}" initialized.` },
      { boardId: board.id, userId: teamMembers[2].id, action: 'MOVE_CARD', details: `Task "design: Create glassmorphism design variables..." moved to column "Done".` },
      { boardId: board.id, userId: teamMembers[0].id, action: 'CREATE_CARD', details: `Task "feat: Implement secure JWT rotation..." assigned to Alex Mercer.` }
    ]
  });

  console.log('✅ Enterprise sprint data and telemetry logs seeded successfully.');
  console.log('🌱 Seeding completed successfully! Run npm run start to launch.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
