import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Querying database for AI Insights...');
  try {
    const insights = await prisma.aIInsight.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`Successfully retrieved ${insights.length} insights:`);
    console.log(JSON.stringify(insights, null, 2));
  } catch (error) {
    console.error('Failed to query AI Insights:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
