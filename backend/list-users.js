import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, isVerified: true }
    });
    console.log('Registered Users in DB:');
    console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Failed to list users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
