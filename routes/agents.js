const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all agents with optional filtering
router.get('/', async (req, res) => {
  try {
    const { search, location, specialty } = req.query;

    // Build where clause based on filters
    const whereClause = {
      isVerified: true,
      ...(search && {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { specialties: { hasSome: [search] } }
        ]
      }),
      ...(location && location !== 'all' && { 
        user: { 
          OR: [
            { firstName: { contains: location, mode: 'insensitive' } },
            { lastName: { contains: location, mode: 'insensitive' } }
          ]
        }
      }),
      ...(specialty && specialty !== 'all' && { 
        specialties: { has: specialty } 
      })
    };

    const agents = await prisma.agent.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        },
        properties: {
          select: {
            id: true,
            status: true,
            price: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedAgents = agents.map(agent => {
      const soldProperties = agent.properties.filter(p => p.status === 'SOLD').length;
      const totalReviews = agent.properties.reduce((sum, p) => sum + (p.reviews?.length || 0), 0);
      
      return {
        id: agent.id,
        name: `${agent.user.firstName} ${agent.user.lastName}`,
        email: agent.user.email,
        image: agent.user.avatar,
        title: 'Real Estate Agent',
        location: agent.specialties?.[0] || 'Available',
        bio: agent.bio || 'Experienced real estate professional',
        specialties: agent.specialties || ['Real Estate'],
        rating: 4.5, // Default rating for now
        reviews: totalReviews,
        propertiesSold: soldProperties,
        yearsExperience: 5, // Default for now
        licenseNumber: agent.licenseNumber,
        isVerified: agent.isVerified,
        phone: agent.phone,
        profileImage: agent.profileImage
      };
    });

    res.json({
      agents: transformedAgents,
      total: transformedAgents.length,
      hasMore: false // For pagination support
    });

  } catch (error) {
    console.error('Error fetching agents:', error.message, error.stack);
    res.status(500).json({ 
      message: 'Error fetching agents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get agent profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const agent = await prisma.agent.findUnique({
      where: { userId: decoded.userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        },
        properties: {
          include: {
            reviews: {
              select: {
                rating: true,
                comment: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent profile not found' });
    }

    res.json({ agent });
  } catch (error) {
    console.error('Error fetching agent profile:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agent profile.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update agent profile
router.put('/profile', [
  body('licenseNumber').optional().trim().isLength({ min: 5 }),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }),
  body('specialties').optional().isArray(),
  body('bio').optional().trim().isLength({ min: 10 }),
  body('phone').optional().isMobilePhone(),
  body('profileImage').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const agent = await prisma.agent.update({
      where: { userId: decoded.userId },
      data: req.body,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ agent });
  } catch (error) {
    console.error('Error updating agent profile:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while updating agent profile.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get agent analytics
router.get('/analytics', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const agent = await prisma.agent.findUnique({
      where: { userId: decoded.userId }
    });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const analytics = await prisma.property.aggregate({
      where: { agentId: agent.id },
      _count: { id: true },
      _sum: { price: true },
      _avg: { price: true }
    });

    const properties = await prisma.property.findMany({
      where: { agentId: agent.id },
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      analytics: {
        totalProperties: analytics._count.id,
        totalValue: analytics._sum.price,
        averagePrice: analytics._avg.price,
        properties
      }
    });
  } catch (error) {
    console.error('Error fetching agent analytics:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agent analytics.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get agent properties
router.get('/:agentId/properties', async (req, res) => {
  try {
    const { agentId } = req.params;

    const properties = await prisma.property.findMany({
      where: { agentId },
      include: {
        agent: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ properties });
  } catch (error) {
    console.error('Error fetching agent properties:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agent properties.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get agent stats
router.get('/:agentId/stats', async (req, res) => {
  try {
    const { agentId } = req.params;

    const stats = await prisma.property.aggregate({
      where: { agentId },
      _count: { id: true },
      _sum: { price: true },
      _avg: { price: true }
    });

    res.json({
      stats: {
        totalProperties: stats._count.id,
        totalValue: stats._sum.price,
        averagePrice: stats._avg.price
      }
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agent stats.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
