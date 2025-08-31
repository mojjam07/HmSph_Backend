const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAgent } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all properties with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      priceMin,
      priceMax,
      bedrooms,
      bathrooms,
      propertyType,
      city,
      state
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {
      status: 'ACTIVE',
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(priceMin && { price: { gte: parseInt(priceMin) } }),
      ...(priceMax && { price: { lte: parseInt(priceMax) } }),
      ...(bedrooms && { bedrooms: parseInt(bedrooms) }),
      ...(bathrooms && { bathrooms: { gte: parseFloat(bathrooms) } }),
      ...(propertyType && { propertyType }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(state && { state: { contains: state, mode: 'insensitive' } })
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
    console.error('Error fetching properties:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching properties.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search properties with advanced filtering
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 10,
      priceMin,
      priceMax,
      bedrooms,
      bathrooms,
      propertyType,
      city,
      state
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {
      status: 'ACTIVE',
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } }
        ]
      }),
      ...(priceMin && { price: { gte: parseInt(priceMin) } }),
      ...(priceMax && { price: { lte: parseInt(priceMax) } }),
      ...(bedrooms && { bedrooms: parseInt(bedrooms) }),
      ...(bathrooms && { bathrooms: { gte: parseFloat(bathrooms) } }),
      ...(propertyType && { propertyType }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(state && { state: { contains: state, mode: 'insensitive' } })
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
    console.error('Error searching properties:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while searching for properties.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single property
router.get('/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
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
        },
        reviews: {
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
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ property });
  } catch (error) {
    console.error('Error fetching property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching the property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create property
router.post('/', [
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
], authenticate, requireAgent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id }
    });

    if (!agent) {
      return res.status(403).json({ message: 'Only agents can create properties' });
    }

    const property = await prisma.property.create({
      data: {
        ...req.body,
        status: 'PENDING', // Properties created by agents start as pending
        agentId: agent.id
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
    console.error('Error creating property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while creating the property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update property
router.put('/:id', [
  body('title').optional().trim().isLength({ min: 3 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('price').optional().isInt({ min: 0 }),
  body('address').optional().trim().isLength({ min: 5 }),
  body('city').optional().trim().isLength({ min: 2 }),
  body('state').optional().trim().isLength({ min: 2 }),
  body('zipCode').optional().trim().isLength({ min: 5 }),
  body('bedrooms').optional().isInt({ min: 0 }),
  body('bathrooms').optional().isFloat({ min: 0 }),
  body('squareFootage').optional().isInt({ min: 0 })
], authenticate, requireAgent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await prisma.property.findUnique({
      where: { id: req.params.id }
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id }
    });

    if (!agent || property.agentId !== agent.id) {
      return res.status(403).json({ message: 'Not authorized to update this property' });
    }

    const updatedProperty = await prisma.property.update({
      where: { id: req.params.id },
      data: req.body,
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
    console.error('Error updating property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while updating the property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete property
router.delete('/:id', authenticate, requireAgent, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id }
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id }
    });

    if (!agent || property.agentId !== agent.id) {
      return res.status(403).json({ message: 'Not authorized to delete this property' });
    }

    await prisma.property.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while deleting the property.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
