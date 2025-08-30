const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Hash the password
    const password = 'user123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create regular user
    const regularUser = await prisma.user.create({
      data: {
        email: 'user@test.com',
        password: hashedPassword,
        firstName: 'Regular',
        lastName: 'User',
        role: 'USER'
      }
    });
    
    console.log('✅ Regular user created successfully!');
    console.log('Email:', regularUser.email);
    console.log('Password:', password);
    console.log('Role:', regularUser.role);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️  Regular user already exists');
    } else {
      console.error('❌ Error creating regular user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
