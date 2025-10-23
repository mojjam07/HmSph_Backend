const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get user's favorite properties
router.get('/', authenticate, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        property: {
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
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const properties = favorites.map(fav => fav.property);
    
    res.json({
      properties,
      total: properties.length
    });
  } catch (error) {
    console.error('Error fetching favorites:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching favorites.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add property to favorites
router.post('/', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required' });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: propertyId
        }
      }
    });

    if (existingFavorite) {
      return res.status(409).json({ message: 'Property already in favorites' });
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user.id,
        propertyId: propertyId
      },
      include: {
        property: {
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
        }
      }
    });

    res.status(201).json({ 
      message: 'Property added to favorites',
      favorite 
    });
  } catch (error) {
    console.error('Error adding favorite:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while adding favorite.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Remove property from favorites
router.delete('/:propertyId', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: propertyId
        }
      }
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    await prisma.favorite.delete({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: propertyId
        }
      }
    });

    res.json({ message: 'Property removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while removing favorite.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if property is favorited by user
router.get('/check/:propertyId', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId: req.user.id,
          propertyId: propertyId
        }
      }
    });

    res.json({
      isFavorited: !!favorite,
      favoriteId: favorite?.id
    });
  } catch (error) {
    console.error('Error checking favorite status:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while checking favorite status.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get admin's favorite properties (public endpoint for landing page)
router.get('/admin', async (req, res) => {
  try {
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.error('Admin user not found');
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: adminUser.id },
      include: {
        property: {
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
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!favorites || favorites.length === 0) {
      console.warn('No favorites found for admin user');
    }

    const properties = favorites.map(fav => fav.property);

    console.log('Properties data:', JSON.stringify(properties, null, 2));

    res.json({
      properties,
      total: properties.length
    });
  } catch (error) {
    console.error('Error fetching admin favorites:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching admin favorites.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
