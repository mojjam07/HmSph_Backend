const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Monkey-patch BigInt to allow JSON serialization globally.
// This is the standard and most robust fix for Prisma's BigInt support.
// BigInt.prototype.toJSON = function() { return this.toString(); };

const authRoutes = require('./routes/auth');
const authDebugRoutes = require('./routes/auth-debug');
const propertyRoutes = require('./routes/properties');
const agentRoutes = require('./routes/agents');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const favoritesRoutes = require('./routes/favorites');
const reviewsRoutes = require('./routes/reviews');
const contactRoutes = require('./routes/contact');
const { prisma, dbManager } = require('./config/database');

const app = express();

// Check for required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'PORT'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
// app.use(compression()); // Temporarily disabled to test JSON issues
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make Prisma client available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth-debug', authDebugRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    // Use explicit JSON.stringify
    const response = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database connection failed'
    };

    res.status(503);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(errorResponse));
  }
});

// Environment check endpoint
app.get('/api/env-check', (req, res) => {
  const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingVars.length > 0) {
    res.status(400).json({
      status: 'ERROR',
      missing: missingVars,
      message: 'Missing required environment variables'
    });
  } else {
    res.json({
      status: 'OK',
      message: 'All required environment variables are configured'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection test
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

const PORT = process.env.PORT || 3000;

// Start server with database connection check
async function startServer() {
  const dbConnected = await testDatabaseConnection();
  
  if (dbConnected) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
  } else {
    console.error('Server failed to start due to database connection issues');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
