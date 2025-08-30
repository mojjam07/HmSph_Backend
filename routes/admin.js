const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin middleware to all routes
router.use(requireAdmin);

// Get admin dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const [
      totalAgents,
      totalProperties,
      totalUsers,
      activeListings,
      pendingListings,
      totalRevenue
    ] = await Promise.all([
      prisma.agent.count({ where: { isVerified: true } }),
      prisma.property.count(),
      prisma.user.count(),
      prisma.property.count({ where: { status: 'ACTIVE' } }),
      prisma.property.count({ where: { status: 'PENDING' } }),
      prisma.property.aggregate({
        _sum: { price: true },
        where: { status: 'SOLD' }
      })
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await prisma.property.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo }
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      stats: {
        totalAgents,
        totalProperties,
        totalUsers,
        activeListings,
        pendingListings,
        totalRevenue: totalRevenue._sum.price || 0
      },
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        title: activity.title,
        type: 'property',
        action: 'created',
        agentName: activity.agent ? `${activity.agent.user.firstName} ${activity.agent.user.lastName}` : 'Unknown',
        timestamp: activity.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching admin stats.',
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
