const request = require('supertest');
const app = require('../app'); // Adjusted to import app.js for testing
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Contact Form Submission', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should save contact submission to the database', async () => {
    const response = await request(app)
      .post('/api/contact/submit')
      .send({
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        subject: 'Test Inquiry',
        message: 'This is a test message.',
        inquiryType: 'general',
        userId: null,
        agentId: null,
        propertyId: null
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Thank you for contacting us! We will get back to you within 24 hours.');

    // Check if the contact was saved in the database
    const contact = await prisma.contact.findFirst({
      where: { email: 'john.doe@example.com' }
    });
    expect(contact).not.toBeNull();
    expect(contact.name).toBe('John Doe');
  });
});
