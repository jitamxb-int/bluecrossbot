#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment..."

# Check if .env file exists
if [ ! -f backend/.env ]; then
    echo "❌ .env file not found! Please create one based on backend/.env.example"
    exit 1
fi

echo "Git pulling latest changes..."
git pull origin master

echo "📦 Building and starting containers..."
docker compose -f backend/docker-compose.yml up -d --build

echo "🧹 Cleaning up docker..."
docker system prune -a -f

echo "✅ Deployment successful!"

# sed -i 's/\r$//' deploy.sh
# To make the script executable, run: chmod +x deploy.sh
# To run the script, run: bash deploy.sh