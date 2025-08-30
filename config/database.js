const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Enhanced database connection with retry logic
class DatabaseManager {
  constructor() {
    this.prisma = prisma;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async connectWithRetry() {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        await this.prisma.$connect();
        console.log('✅ Database connected successfully');
        return true;
      } catch (error) {
        retries++;
        console.error(`❌ Database connection attempt ${retries} failed:`, error.message);
        
        if (retries < this.maxRetries) {
          console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          console.error('❌ All database connection attempts failed');
          throw error;
        }
      }
    }
  }

  async disconnect() {
    try {
      await this.prisma.$disconnect();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error.message);
    }
  }

  async testConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
  }
}

const dbManager = new DatabaseManager();

module.exports = {
  prisma: dbManager.prisma,
  dbManager
};
