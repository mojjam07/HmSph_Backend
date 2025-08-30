const { PrismaClient } = require('@prisma/client');

async function checkAllTables() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking all database tables...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    console.log('\n📊 Table Status and Record Counts:');
    
    // Check all tables defined in the Prisma schema
    const tables = [
      'User',
      'Agent', 
      'Property',
      'Review',
      'Favorite',
      'Contact',
      'Payment',
      'Subscription'
    ];
    
    for (const table of tables) {
      try {
        const count = await prisma[table.toLowerCase()].count();
        console.log(`✅ ${table} table: ${count} records`);
      } catch (error) {
        console.log(`❌ ${table} table: Not accessible or doesn't exist`);
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log('\n📋 Table Structure Information:');
    
    // Get all tables from information_schema
    try {
      const allTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      console.log('\n📁 All tables in the database:');
      allTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      
    } catch (error) {
      console.log('❌ Could not retrieve table list from information_schema');
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables();
