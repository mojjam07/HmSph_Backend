const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Hash a new password
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update the user's password
    const updatedUser = await prisma.user.update({
      where: { email: 'agent@test.com' },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Password reset successfully!');
    console.log('Email:', updatedUser.email);
    console.log('New password:', newPassword);
    console.log('Role:', updatedUser.role);
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
