const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all reviews
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'newest' } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const orderBy = {};
    switch (sortBy) {
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'oldest':
        orderBy.createdAt = 'asc';
        break;
      case 'highest':
        orderBy.rating = 'desc';
        break;
      case 'lowest':
        orderBy.rating = 'asc';
        break;
      default:
        orderBy.createdAt = 'desc';
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          status: 'APPROVED' // Only show approved reviews publicly
        },
        skip,
        take,
        orderBy,
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
      prisma.review.count({
        where: {
          status: 'APPROVED' // Only count approved reviews
        }
      })
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching reviews:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get reviews for a specific property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          status: 'APPROVED',
          propertyId: propertyId
        },
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
          }
        }
      }),
      prisma.review.count({
        where: {
          propertyId: propertyId,
          status: 'APPROVED'
        }
      })
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching property reviews:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching property reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get reviews for a specific agent
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          status: 'APPROVED', // Only show approved reviews publicly
          agentId: agentId // Direct agent reviews
        },
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
          agent: {
            select: {
              id: true,
              businessName: true,
              phone: true,
              profileImage: true
            }
          }
        }
      }),
      prisma.review.count({
        where: {
          agentId: agentId,
          status: 'APPROVED'
        }
      })
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching agent reviews:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching agent reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get reviews by user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          status: 'APPROVED',
          userId: userId
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              address: true,
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
            }
          },
          agent: {
            select: {
              id: true,
              businessName: true,
              phone: true
            }
          }
        }
      }),
      prisma.review.count({
        where: {
          userId: userId,
          status: 'APPROVED'
        }
      })
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching user reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new review
router.post('/', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').trim().isLength({ min: 10, max: 1000 }),
  body('propertyId').optional().isString(),
  body('agentId').optional().isString()
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

    const { rating, comment, propertyId, agentId } = req.body;

    // Require either propertyId or agentId
    if (!propertyId && !agentId) {
      return res.status(400).json({ message: 'Either propertyId or agentId must be provided for reviews' });
    }

    // Validate propertyId or agentId exists
    if (propertyId) {
      const propertyExists = await prisma.property.findUnique({
        where: { id: propertyId }
      });
      if (!propertyExists) {
        return res.status(400).json({ message: 'Invalid propertyId: property does not exist' });
      }
    }

    if (agentId) {
      const agentExists = await prisma.agent.findUnique({
        where: { id: agentId }
      });
      if (!agentExists) {
        return res.status(400).json({ message: 'Invalid agentId: agent does not exist' });
      }
    }

    // Check if user already reviewed this property or agent
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: decoded.userId,
        OR: [
          { propertyId: propertyId || undefined },
          { agentId: agentId || undefined }
        ]
      }
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this property or agent' });
    }

    const reviewData = {
      rating: parseInt(rating),
      comment: comment.trim(),
      userId: decoded.userId,
      status: 'PENDING'
    };

    if (propertyId) reviewData.propertyId = propertyId;
    if (agentId) reviewData.agentId = agentId;

    const review = await prisma.review.create({
      data: reviewData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        property: propertyId ? {
          select: {
            id: true,
            title: true,
            address: true
          }
        } : false,
        agent: agentId ? {
          select: {
            id: true,
            businessName: true,
            phone: true,
            profileImage: true
          }
        } : false
      }
    });

    res.status(201).json({ review });
  } catch (error) {
    console.error('Error creating review:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while creating review.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Like a review
router.post('/:id/like', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const review = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // For now, just increment likes count
    // In a real implementation, you might want to track individual user likes
    const updatedReview = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        likes: (review.likes || 0) + 1
      }
    });

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Error liking review:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while liking review.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Dislike a review
router.post('/:id/dislike', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const review = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // For now, just increment dislikes count
    const updatedReview = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        dislikes: (review.dislikes || 0) + 1
      }
    });

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Error disliking review:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while disliking review.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await prisma.review.aggregate({
      _avg: {
        rating: true
      },
      _count: {
        id: true
      },
      _min: {
        rating: true
      },
      _max: {
        rating: true
      }
    });

    const ratingDistribution = await prisma.review.groupBy({
      by: ['rating'],
      _count: {
        id: true
      },
      orderBy: {
        rating: 'desc'
      }
    });

    res.json({
      averageRating: stats._avg.rating,
      totalReviews: stats._count.id,
      minRating: stats._min.rating,
      maxRating: stats._max.rating,
      ratingDistribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = item._count.id;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching review stats:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching review stats.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin endpoints for review management
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
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
          },
          agent: {
            select: {
              id: true,
              businessName: true,
              phone: true,
              profileImage: true
            }
          }
        }
      }),
      prisma.review.count()
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching all reviews for admin:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching reviews.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/admin/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          status: 'PENDING'
        },
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
          },
          agent: {
            select: {
              id: true,
              businessName: true,
              phone: true,
              profileImage: true
            }
          }
        }
      }),
      prisma.review.count({
        where: {
          status: 'PENDING'
        }
      })
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
router.put('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const updatedReview = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED'
      },
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
        },
        agent: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            profileImage: true
          }
        }
      }
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
router.put('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: req.params.id }
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const updatedReview = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED'
      },
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
        },
        agent: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            profileImage: true
          }
        }
      }
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

module.exports = router;
