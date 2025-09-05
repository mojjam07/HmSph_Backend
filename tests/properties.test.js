const request = require('supertest');
const app = require('../app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Properties API Endpoints', () => {
  let server;

  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    server.close();
  });

  it('should fetch list of properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .expect(200);

    // The API returns an object with properties array, total, page, pages
    expect(res.body).toHaveProperty('properties');
    expect(Array.isArray(res.body.properties)).toBe(true);
  });

  it('should fetch a single property by ID', async () => {
    // First get a property ID from the list
    const listRes = await request(app)
      .get('/api/properties')
      .expect(200);

    if (!listRes.body.properties || listRes.body.properties.length === 0) {
      return;
    }

    const propertyId = listRes.body.properties[0].id;

    const res = await request(app)
      .get(`/api/properties/${propertyId}`)
      .expect(200);

    // The API returns an object with property key
    expect(res.body).toHaveProperty('property');
    expect(res.body.property).toHaveProperty('id', propertyId);
  });

  it('should return 404 for non-existent property', async () => {
    const res = await request(app)
      .get('/api/properties/nonexistentid')
      .expect(404);

    expect(res.body).toHaveProperty('message');
  });
});
