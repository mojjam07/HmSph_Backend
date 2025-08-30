# Database Setup Guide

## Prerequisites
- PostgreSQL installed and running
- Node.js and npm installed
- Prisma CLI installed globally: `npm install -g prisma`

## Setup Steps

### 1. Install PostgreSQL
If not already installed:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Download and install from https://www.postgresql.org/download/windows/
```

### 2. Create Database and User
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE homesphere_db;

# Create user (optional, can use postgres user)
CREATE USER homesphere_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE homesphere_db TO homesphere_user;

# Exit
\q
```

### 3. Update .env file
Add the DATABASE_URL to your .env file:

```bash
# For local development with default postgres user
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/homesphere_db"

# For local development with custom user
DATABASE_URL="postgresql://homesphere_user:your_password@localhost:5432/homesphere_db"

# For Docker (if using Docker setup)
DATABASE_URL="postgresql://postgres:password@localhost:5432/homesphere_db"
```

### 4. Install Dependencies
```bash
cd backend
npm install
```

### 5. Set up Prisma
```bash
# Generate Prisma client
npx prisma generate

# Create and apply database migrations
npx prisma migrate dev --name init

# Seed the database (optional)
npx prisma db seed
```

### 6. Verify Database Connection
```bash
# Test the connection
npx prisma db pull
```

## Common Issues and Solutions

### Issue: "Environment variable not found: DATABASE_URL"
**Solution**: Ensure your .env file contains the DATABASE_URL variable with correct format.

### Issue: "Connection refused"
**Solution**: 
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Verify the connection string format
- Check firewall settings

### Issue: "Database does not exist"
**Solution**: Create the database manually using the SQL commands above.

## Database Schema
The application uses the following models:
- User (authentication)
- Agent (real estate agents)
- Property (property listings)
- Review (property reviews)
- Favorite (user favorites)

## Testing the Connection
After setup, you can test the connection by running:
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.$connect().then(() => console.log('Connected successfully')).catch(e => console.error(e))"
