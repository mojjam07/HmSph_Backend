const express = require('express');
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

// Get all agents for admin management
router.get('/agents', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {
      ...(search && {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { licenseNumber: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && status !== 'all' && { verificationStatus: status })
    };

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

    const transformedAgents = agents.map(agent => {
      const activeProperties = agent.properties.filter(p => p.status === 'ACTIVE').length;
      const soldProperties = agent.properties.filter(p => p.status === 'SOLD').length;

      return {
        agentId: agent.id,
        firstName: agent.user.firstName,
        lastName: agent.user.lastName,
        email: agent.user.email,
        phone: agent.phone,
        businessName: agent.businessName,
        licenseNumber: agent.licenseNumber,
        isVerified: agent.isVerified,
        verificationStatus: agent.verificationStatus,
        subscriptionPlan: agent.subscriptionPlan,
        currentMonthListings: activeProperties,
        listingLimits: agent.listingLimits || 25,
        profilePicture: agent.user.avatar || '/api/placeholder/64/64',
        totalSales: soldProperties,
        rating: 4.8, // Default for now
        joinedDate: agent.user.createdAt,
        lastActive: agent.updatedAt
      };
    });

    res.json({
      agents: transformedAgents,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
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

    res.json({ stats });
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
