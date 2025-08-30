#!/bin/bash

# Database Setup Script for HomeSphere Backend
# This script helps set up the PostgreSQL database for the HomeSphere application

echo "🚀 HomeSphere Database Setup"
echo "================================"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    echo "Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "macOS: brew install postgresql"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL service."
    echo "Ubuntu/Debian: sudo systemctl start postgresql"
    echo "macOS: brew services start postgresql"
    exit 1
fi

# Default values
DB_NAME="homesphere_db"
DB_USER="postgres"
DB_PASSWORD="password"

# Ask for user input
read -p "Enter database name (default: $DB_NAME): " input_db_name
DB_NAME=${input_db_name:-$DB_NAME}

read -p "Enter PostgreSQL username (default: $DB_USER): " input_db_user
DB_USER=${input_db_user:-$DB_USER}

read -s -p "Enter PostgreSQL password: " input_db_password
DB_PASSWORD=${input_db_password:-$DB_PASSWORD}
echo ""

# Create database
echo "📊 Creating database: $DB_NAME"
sudo -u $DB_USER psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "⚠️  Database may already exist"

# Create .env file
echo "📝 Creating .env file"
cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_change_this_in_production

# Server Configuration
PORT=5000
NODE_ENV=development

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
EOF

echo "✅ .env file created successfully!"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev --name init

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Test the API endpoints"
echo "3. Check the database connection"
echo ""
echo "Database URL: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
