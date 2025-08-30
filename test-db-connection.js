const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test if all tables are accessible
    console.log('\nTesting table accessibility:');
    
    // Test User table
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible (${userCount} records)`);
    
    // Test Agent table
    const agentCount = await prisma.agent.count();
    console.log(`✅ Agent table accessible (${agentCount} records)`);
    
    // Test Property table
    const propertyCount = await prisma.property.count();
    console.log(`✅ Property table accessible (${propertyCount} records)`);
    
    // Test Contact table (newly created)
    const contactCount = await prisma.contact.count();
    console.log(`✅ Contact table accessible (${contactCount} records)`);
    
    // Test Payment table (newly created)
    const paymentCount = await prisma.payment.count();
    console.log(`✅ Payment table accessible (${paymentCount} records)`);
    
    // Test Subscription table (newly created)
    const subscriptionCount = await prisma.subscription.count();
    console.log(`✅ Subscription table accessible (${subscriptionCount} records)`);
    
    console.log('\n🎉 All database tables are accessible and working correctly!');
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
