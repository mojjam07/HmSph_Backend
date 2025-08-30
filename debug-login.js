#!/usr/bin/env node

// Diagnostic script to identify login issues
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('🔍 HomeSphere Login Diagnostic Tool\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}

// Test database connection
async function testDatabaseConnection() {
  console.log('\n🔗 Database Connection Test:');
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test basic query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query test passed');
    
    // Check if users table exists
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Test JWT configuration
function testJWTConfig() {
  console.log('\n🔐 JWT Configuration Test:');
  
  try {
    const testPayload = { userId: 1, email: 'test@example.com' };
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('✅ JWT signing and verification working');
    return true;
  } catch (error) {
    console.error('❌ JWT configuration error:', error.message);
    return false;
  }
}

// Test bcrypt
async function testBcrypt() {
  console.log('\n🔒 Bcrypt Test:');
  
  try {
    const password = 'testpassword123';
    const hashed = await bcrypt.hash(password, 12);
    const isMatch = await bcrypt.compare(password, hashed);
    
    console.log('✅ Bcrypt hashing and comparison working');
    return true;
  } catch (error) {
    console.error('❌ Bcrypt error:', error.message);
    return false;
  }
}

// Run all tests
async function runDiagnostics() {
  const dbOk = await testDatabaseConnection();
  const jwtOk = testJWTConfig();
  const bcryptOk = await testBcrypt();
  
  console.log('\n📊 Diagnostic Summary:');
  console.log(`Database: ${dbOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`JWT: ${jwtOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Bcrypt: ${bcryptOk ? '✅ OK' : '❌ FAILED'}`);
  
  if (dbOk && jwtOk && bcryptOk) {
    console.log('\n🎉 All systems are working correctly!');
    console.log('The login error might be due to:');
    console.log('1. Incorrect login credentials');
    console.log('2. Network issues between frontend and backend');
    console.log('3. CORS configuration issues');
  } else {
    console.log('\n⚠️  Please fix the issues above before testing login');
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);
