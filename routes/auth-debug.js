const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Enhanced login route with detailed error logging
router.post('/login-debug', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[${requestId}] 🔍 Login attempt started`);
  console.log(`[${requestId}] 📧 Email: ${req.body.email}`);
  console.log(`[${requestId}] 🔒 Password provided: ${!!req.body.password}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`[${requestId}] ❌ Validation errors:`, errors.array());
      return res.status(400).json({ 
        errors: errors.array(),
        debug: { requestId, validation: 'failed' }
      });
    }

    const { email, password } = req.body;

    // Check environment variables
    if (!process.env.JWT_SECRET) {
      console.error(`[${requestId}] ❌ JWT_SECRET not configured`);
      return res.status(500).json({ 
        message: 'Server configuration error',
        debug: { requestId, error: 'JWT_SECRET missing' }
      });
    }

    console.log(`[${requestId}] 🔍 Looking up user: ${email}`);
    
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { agent: true }
    });

    console.log(`[${requestId}] 👤 User found: ${!!user}`);
    
    if (!user) {
      console.log(`[${requestId}] ❌ User not found: ${email}`);
      return res.status(400).json({ 
        message: 'Invalid credentials',
        debug: { requestId, reason: 'user_not_found' }
      });
    }

    console.log(`[${requestId}] 🔒 Comparing passwords...`);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[${requestId}] 🔐 Password match: ${isMatch}`);

    if (!isMatch) {
      console.log(`[${requestId}] ❌ Invalid password for user: ${email}`);
      return res.status(400).json({ 
        message: 'Invalid credentials',
        debug: { requestId, reason: 'invalid_password' }
      });
    }

    console.log(`[${requestId}] 🎯 Generating JWT token...`);
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Login successful (${duration}ms)`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        agent: user.agent
      },
      debug: { requestId, duration: `${duration}ms` }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Login error:`, error);
    console.error(`[${requestId}] Error details:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    // Enhanced error handling
    if (error.code === 'P1001') {
      return res.status(503).json({ 
        message: 'Database connection failed',
        debug: { 
          requestId, 
          error: 'database_connection',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }

    if (error.code === 'P1000') {
      return res.status(503).json({ 
        message: 'Database authentication failed',
        debug: { 
          requestId, 
          error: 'database_auth',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }

    if (error.message.includes('JWT_SECRET')) {
      return res.status(500).json({ 
        message: 'Server configuration error',
        debug: { 
          requestId, 
          error: 'jwt_config',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }

    res.status(500).json({ 
      message: 'Server error occurred',
      debug: { 
        requestId, 
        error: 'server_error',
        duration: `${duration}ms`,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Health check endpoint for debugging
router.get('/health-debug', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    jwt_secret: !!process.env.JWT_SECRET,
    database_url: !!process.env.DATABASE_URL,
    cors_origin: process.env.CORS_ORIGIN || 'not set'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch (error) {
    checks.database = 'failed';
    checks.database_error = error.message;
  }

  try {
    const testPayload = { test: true };
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
    jwt.verify(token, process.env.JWT_SECRET);
    checks.jwt = 'working';
  } catch (error) {
    checks.jwt = 'failed';
    checks.jwt_error = error.message;
  }

  try {
    await bcrypt.hash('test', 12);
    checks.bcrypt = 'working';
  } catch (error) {
    checks.bcrypt = 'failed';
    checks.bcrypt_error = error.message;
  }

  res.json(checks);
});

module.exports = router;
