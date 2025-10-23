const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 2 }),
  body('lastName').trim().isLength({ min: 2 }),
  body('role').isIn(['USER', 'AGENT']),
  body('phone').optional().isMobilePhone(),
  body('businessName').optional().trim().isLength({ min: 2 }),
  body('registrationNumber').if(body('role').equals('AGENT')).notEmpty().withMessage('Registration number is required').trim().isLength({ min: 3 }),
  body('yearsOfExperience').optional().isInt({ min: 0, max: 50 })
], async (req, res) => {
  try {
    // Proactively check for JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('Registration error: JWT_SECRET is not configured.');
      return res.status(500).json({
        message: 'Server configuration error. Please contact administrator.',
        code: 'JWT_CONFIG_ERROR'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, role, phone, businessName, registrationNumber, yearsOfExperience } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // If role is AGENT, create an Agent record with verificationStatus PENDING
    if (role === 'AGENT') {
      // Check if registration number is already taken
      const existingAgent = await prisma.agent.findUnique({ where: { registrationNumber } });
      if (existingAgent) {
        return res.status(400).json({ message: 'Registration number already exists' });
      }

      await prisma.agent.create({
        data: {
          userId: user.id,
          registrationNumber: registrationNumber || '',
          verificationStatus: 'PENDING',
          businessName: businessName || null,
          phone: phone || null,
          specialties: yearsOfExperience ? [`${yearsOfExperience} years experience`] : []
        }
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' } // Added default value
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific database errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        message: 'User already exists with this email',
        code: 'DUPLICATE_EMAIL'
      });
    }
    
    if (error.code === 'P1001') {
      return res.status(503).json({ 
        message: 'Database connection failed. Please try again later.',
        code: 'DATABASE_CONNECTION_ERROR'
      });
    }
    
    // Handle validation errors
    if (error.code === 'P2000') {
      return res.status(400).json({ 
        message: 'Input data too long',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Handle bcrypt errors
    if (error.message.includes('bcrypt')) {
      return res.status(500).json({ 
        message: 'Password processing error',
        code: 'PASSWORD_ERROR'
      });
    }
    
    // Generic server error
    res.status(500).json({ 
      message: 'Server error occurred. Please try again later.',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    // Proactively check for JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('Login error: JWT_SECRET is not configured.');
      return res.status(500).json({
        message: 'Server configuration error. Please contact administrator.',
        code: 'JWT_CONFIG_ERROR'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { agent: true }
    });

    if (!user) {
      // Security best practice: use a generic message for both user not found and invalid password
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const { password: _, ...userWithoutPassword } = user;

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' } // Added default value
    );

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    
    // Handle specific database errors
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        message: 'User already exists with this email',
        code: 'DUPLICATE_EMAIL'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(400).json({ 
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (error.code === 'P1001') {
      return res.status(503).json({ 
        message: 'Database connection failed. Please check server configuration.',
        code: 'DATABASE_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.code === 'P1000') {
      return res.status(503).json({ 
        message: 'Database authentication failed. Please check database credentials.',
        code: 'DATABASE_AUTH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Handle JWT configuration errors
    if (error.message && (error.message.includes('JWT_SECRET') || error.message.includes('secretOrPrivateKey'))) {
      return res.status(500).json({ 
        message: 'Server configuration error. JWT secret not configured.',
        code: 'JWT_CONFIG_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Authentication token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Handle bcrypt errors
    if (error.message && error.message.includes('bcrypt')) {
      return res.status(500).json({ 
        message: 'Password processing error',
        code: 'PASSWORD_ERROR'
      });
    }
    
    // Handle missing environment variables
    if (error.message && error.message.includes('process.env')) {
      return res.status(500).json({ 
        message: 'Server configuration error. Please contact administrator.',
        code: 'CONFIG_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Handle Prisma connection issues
    if (error.message && error.message.includes('Prisma')) {
      return res.status(503).json({ 
        message: 'Database service unavailable. Please try again later.',
        code: 'DATABASE_SERVICE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Generic server error with more context
    res.status(500).json({ 
      message: 'Server error occurred. Please try again later.',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { agent: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user (me endpoint)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { agent: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Me fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
