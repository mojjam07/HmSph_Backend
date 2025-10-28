const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication and admin middleware to all routes
router.use(authenticate);
router.use(requireAdmin);


// Get pending reviews for admin approval
router.get('/reviews/pending', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { status: 'PENDING' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              address: true
            }
          }
        }
      }),
      prisma.review.count({ where: { status: 'PENDING' } })
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching pending reviews:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching pending reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Approve a review
router.post('/reviews/:id/approve', async (req, res) => {
  try {
    const reviewId = req.params.id;
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'APPROVED' }
    });
    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Error approving review:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while approving review.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reject a review
router.post('/reviews/:id/reject', async (req, res) => {
  try {
    const reviewId = req.params.id;
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'REJECTED' }
    });
    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Error rejecting review:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while rejecting review.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new agent (admin only)
router.post('/agents', [
  body('firstName').trim().isLength({ min: 2 }),
  body('lastName').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('phone').optional().isMobilePhone(),
  body('businessName').optional().trim().isLength({ min: 2 }),
  body('registrationNumber').trim().isLength({ min: 5 }),
  body('verificationStatus').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  body('subscriptionPlan').optional().isIn(['BASIC', 'PRO', 'PREMIUM', 'ENTERPRISE']),
  body('profileImage').optional().isURL(),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }),
  body('specialties').optional().isArray(),
  body('bio').optional().trim().isLength({ min: 10 }),
  body('listingLimits').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      businessName,
      registrationNumber,
      verificationStatus = 'PENDING',
      subscriptionPlan = 'BASIC',
      profileImage,
      commissionRate = 0.03,
      specialties = [],
      bio,
      listingLimits = 25
    } = req.body;

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Check if registration number is already taken
    const existingAgent = await prisma.agent.findUnique({ where: { registrationNumber } });
    if (existingAgent) {
      return res.status(400).json({ message: 'Registration number already exists' });
    }

    // Hash the password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user first
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'AGENT'
      }
    });

    // Create agent profile
    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        registrationNumber,
        phone,
        businessName,
        verificationStatus,
        subscriptionPlan,
        profileImage,
        commissionRate,
        specialties,
        bio,
        listingLimits
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        agentId: agent.id,
        firstName: agent.user.firstName,
        lastName: agent.user.lastName,
        email: agent.user.email,
        phone: agent.phone,
        businessName: agent.businessName,
        registrationNumber: agent.registrationNumber,
        verificationStatus: agent.verificationStatus,
        subscriptionPlan: agent.subscriptionPlan,
        profilePicture: agent.user.avatar || agent.profileImage
      }
    });
  } catch (error) {
    console.error('Error creating agent by admin:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while creating the agent.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all agents for admin management
router.get('/agents', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause properly handling undefined values
    const where = {};

    // Only add search conditions if search is provided and not empty
    if (search && search.trim() !== '' && search !== 'undefined') {
      where.OR = [
        { user: { firstName: { contains: search.trim(), mode: 'insensitive' } } },
        { user: { lastName: { contains: search.trim(), mode: 'insensitive' } } },
        { registrationNumber: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    // Only add status filter if status is provided and valid
    if (status && status !== 'all' && status !== 'undefined' && status.trim() !== '') {
      // Ensure status is a valid enum value
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
      if (validStatuses.includes(status.toUpperCase())) {
        where.verificationStatus = status.toUpperCase();
      }
    }
    // If no status filter provided (including 'all'), include all agents

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              createdAt: true
            }
          },
          properties: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.agent.count({ where })
    ]);

    // Debug: Log agents and total count to verify data
    console.log(`Admin agents fetched: ${agents.length} / Total: ${total}`);

    const transformedAgents = agents.map(agent => {
      const activeProperties = agent.properties.filter(p => p.status === 'ACTIVE').length;
      const soldProperties = agent.properties.filter(p => p.status === 'SOLD').length;

      // Ensure all values are JSON-serializable
      return {
        agentId: String(agent.id),
        firstName: String(agent.user.firstName),
        lastName: String(agent.user.lastName),
        email: String(agent.user.email),
        phone: String(agent.phone || ''),
        businessName: String(agent.businessName || ''),
        registrationNumber: String(agent.registrationNumber || ''),
        isVerified: Boolean(agent.isVerified),
        verificationStatus: String(agent.verificationStatus),
        subscriptionPlan: String(agent.subscriptionPlan),
        currentMonthListings: Number(activeProperties),
        listingLimits: Number(agent.listingLimits || 25),
        profilePicture: String(agent.user.avatar || '/api/placeholder/64/64'),
        totalSales: Number(soldProperties),
        rating: Number(4.8), // Default for now
        joinedDate: agent.user.createdAt ? agent.user.createdAt.toISOString() : null,
        lastActive: agent.updatedAt ? agent.updatedAt.toISOString() : null
      };
    });

    // Return the actual agents data
    const responseData = {
      agents: transformedAgents,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    };

    // Use explicit JSON.stringify to avoid any Express JSON issues
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(responseData));
  } catch (error) {
    console.error('Error fetching agents for admin:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agents for admin.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Approve an agent
router.post('/agents/:id/approve', async (req, res) => {
  try {
    const agentId = req.params.id;

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      return res.status(404).json({ message: 'Agent not found.' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: { verificationStatus: 'APPROVED' },
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
    res.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Error approving agent:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while approving agent.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reject an agent
router.post('/agents/:id/reject', async (req, res) => {
  try {
    const agentId = req.params.id;
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: { verificationStatus: 'REJECTED' },
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
    res.json({ agent: updatedAgent });
  } catch (error) {
    console.error('Error rejecting agent:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while rejecting agent.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get dashboard stats for admin
router.get('/dashboard/stats', async (req, res) => {
  try {
    const [
      totalAgents,
      totalProperties,
      activeListings,
      pendingReviews,
      totalRevenue
    ] = await Promise.all([
      // Total agents count
      prisma.agent.count(),

      // Total properties count
      prisma.property.count(),

      // Active listings count
      prisma.property.count({ where: { status: 'ACTIVE' } }),

      // Pending reviews count
      prisma.review.count({ where: { status: 'PENDING' } }),

      // Total revenue from sold properties
      prisma.property.aggregate({
        _sum: { price: true },
        where: { status: 'SOLD' }
      })
    ]);

    const stats = {
      totalAgents,
      totalProperties,
      activeListings,
      pendingReviews,
      totalRevenue: totalRevenue._sum.price || 0
    };

    // Ensure proper JSON serialization
    const responseData = { stats };
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(responseData));
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching dashboard stats.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all properties for admin management (including pending)
router.get('/properties', async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'all', search } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {
      ...(status && status !== 'all' && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { agent: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ]
            }
          }}
        ]
      })
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          bedrooms: true,
          bathrooms: true,
          squareFootage: true,
          propertyType: true,
          images: true,
          features: true,
          status: true,
          agentId: true,
          createdAt: true,
          updatedAt: true,
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
      }),
      prisma.property.count({ where })
    ]);

    res.json({
      properties,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching properties for admin:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching properties for admin.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Approve a property
router.post('/properties/:id/approve', async (req, res) => {
  try {
    const propertyId = req.params.id;
    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: { status: 'ACTIVE' },
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
      }
    });
    res.json({ property: updatedProperty });
  } catch (error) {
    console.error('Error approving property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while approving property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reject a property
router.post('/properties/:id/reject', async (req, res) => {
  try {
    const propertyId = req.params.id;
    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: { status: 'REJECTED' },
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
      }
    });
    res.json({ property: updatedProperty });
  } catch (error) {
    console.error('Error rejecting property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while rejecting property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create property for admin
router.post('/properties', [
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 10 }),
  body('price').isInt({ min: 0 }),
  body('address').trim().isLength({ min: 5 }),
  body('city').trim().isLength({ min: 2 }),
  body('state').trim().isLength({ min: 2 }),
  body('zipCode').trim().isLength({ min: 5 }),
  body('bedrooms').isInt({ min: 0 }),
  body('bathrooms').isFloat({ min: 0 }),
  body('squareFootage').isInt({ min: 0 }),
  body('propertyType').isIn(['HOUSE', 'APARTMENT', 'CONDO', 'TOWNHOUSE', 'LAND', 'COMMERCIAL'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // For admin-created properties, we need an agent. Create a system agent if not exists.
    let systemAgent = await prisma.agent.findFirst({
      where: { user: { role: 'ADMIN' } }
    });

    if (!systemAgent) {
      // Create system agent for admin
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
      });
      if (!adminUser) {
        return res.status(400).json({ message: 'No admin user found' });
      }
      systemAgent = await prisma.agent.create({
        data: {
          userId: adminUser.id,
          registrationNumber: 'SYSTEM-ADMIN',
          businessName: 'System Admin',
          isVerified: true,
          verificationStatus: 'APPROVED'
        }
      });
    }

    const property = await prisma.property.create({
      data: {
        ...req.body,
        status: 'ACTIVE', // Admin-created properties are active by default
        agentId: systemAgent.id
      },
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
      }
    });

    res.status(201).json({ property });
  } catch (error) {
    console.error('Error creating property by admin:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while creating the property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get admin analytics data
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    let startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const [
      propertyStats,
      userStats,
      revenueStats,
      topAgents
    ] = await Promise.all([
      // Property statistics
      prisma.property.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: startDate } }
      }),

      // User registration statistics
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: { createdAt: { gte: startDate } }
      }),

      // Revenue statistics
      prisma.property.aggregate({
        _sum: { price: true },
        where: {
          status: 'SOLD',
          createdAt: { gte: startDate }
        }
      }),

      // Top performing agents
      prisma.agent.findMany({
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          properties: {
            where: {
              status: 'SOLD',
              createdAt: { gte: startDate }
            },
            select: {
              price: true
            }
          }
        },
        orderBy: {
          properties: {
            _count: 'desc'
          }
        },
        take: 5
      })
    ]);

    const analytics = {
      propertyStats: propertyStats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.id;
        return acc;
      }, {}),
      userStats: userStats.reduce((acc, stat) => {
        acc[stat.role.toLowerCase()] = stat._count.id;
        return acc;
      }, {}),
      totalRevenue: revenueStats._sum.price || 0,
      topAgents: topAgents.map(agent => ({
        id: agent.id,
        name: `${agent.user.firstName} ${agent.user.lastName}`,
        sales: agent.properties.length,
        revenue: agent.properties.reduce((sum, prop) => sum + (prop.price || 0), 0)
      }))
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Error fetching admin analytics:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching admin analytics.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
