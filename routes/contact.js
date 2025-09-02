const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get contact information
router.get('/info', async (req, res) => {
  try {
    // Return static contact information
    const contactInfo = [
      {
        icon: 'MapPin',
        title: "Visit Our Office",
        details: [
          "123 Victoria Island Road",
          "Lagos Island, Lagos State",
          "Nigeria"
        ],
        color: "blue"
      },
      {
        icon: 'Phone',
        title: "Call Us",
        details: [
          "+234 803 123 4567",
          "+234 806 789 0123",
          "Mon - Fri: 8AM - 6PM"
        ],
        color: "green"
      },
      {
        icon: 'Mail',
        title: "Email Us",
        details: [
          "info@homesphere.com",
          "support@homesphere.com",
          "careers@homesphere.com"
        ],
        color: "purple"
      },
      {
        icon: 'Clock',
        title: "Business Hours",
        details: [
          "Monday - Friday: 8AM - 6PM",
          "Saturday: 9AM - 4PM",
          "Sunday: Closed"
        ],
        color: "orange"
      }
    ];

    res.json(contactInfo);
  } catch (error) {
    console.error('Error fetching contact info:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching contact info.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Submit contact form
router.post('/submit', [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ min: 10, max: 20 }),
  body('subject').trim().isLength({ min: 5, max: 200 }),
  body('message').trim().isLength({ min: 10, max: 2000 }),
  body('inquiryType').isIn(['general', 'sales', 'support', 'partnership', 'careers', 'feedback'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message, inquiryType, userId, agentId, propertyId } = req.body;

    // Save contact submission to database
    const contactSubmission = await prisma.contact.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        inquiryType,
        status: 'NEW',
        userId: userId || null,
        agentId: agentId || null,
        propertyId: propertyId || null
      }
    });

    console.log('Contact form submission saved:', {
      id: contactSubmission.id,
      name,
      email,
      inquiryType,
      timestamp: contactSubmission.createdAt
    });

    res.status(201).json({
      message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      submission: contactSubmission
    });
  } catch (error) {
    console.error('Error processing contact form:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while processing contact form.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get contact form submissions for admin
router.get('/submissions', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {
      ...(status && status !== 'all' && { status })
    };

    const [submissions, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
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
      prisma.contact.count({ where })
    ]);

    res.json({
      submissions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching contact submissions:', error.message, error.stack);
    res.status(500).json({
      message: 'Server error occurred while fetching contact submissions.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
