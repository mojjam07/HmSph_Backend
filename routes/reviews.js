const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

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
          status: 'APPROVED' // Only show approved reviews publicly
        },
        where: { propertyId },
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
      prisma.review.count({ where: { propertyId } })
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
          status: 'APPROVED' // Only show approved reviews publicly
        },
        where: {
          property: {
            agentId: agentId
          }
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
          }
        }
      }),
      prisma.review.count({
        where: {
          property: {
            agentId: agentId
          }
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
          status: 'APPROVED' // Only show approved reviews publicly
        },
        where: { userId },
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
          }
        }
      }),
      prisma.review.count({ where: { userId } })
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
  body('propertyId').isString().notEmpty()
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

    const { rating, comment, propertyId } = req.body;

    // Check if user already reviewed this property
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: decoded.userId,
        propertyId: propertyId
      }
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this property' });
    }

    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        comment: comment.trim(),
        propertyId,
        userId: decoded.userId,
        status: 'PENDING'
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
        }
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

module.exports = router;
