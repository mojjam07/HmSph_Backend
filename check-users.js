const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users in database:', users.length);
    
    if (users.length === 0) {
      console.log('No users found in the database.');
      console.log('You need to create a user first.');
    } else {
      users.forEach(user => {
        console.log('ID:', user.id, 'Email:', user.email, 'Role:', user.role);
      });
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
