#!/bin/bash

echo "🚀 Publo - Engineering Intelligence"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  Please review and update .env with your own values if needed."
    echo "   For local development, the default values will work."
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Ask if user wants to start services
read -p "🎯 Would you like to start all services now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🏗️  Building and starting services..."
    echo "   This may take a few minutes on first run..."
    echo ""
    
    docker-compose up -d --build
    
    echo ""
    echo "⏳ Waiting for services to be ready..."
    sleep 5
    
    echo ""
    echo "✨ Services Status:"
    docker-compose ps
    
    echo ""
    echo "🎉 Setup complete! Your services are running at:"
    echo ""
    echo "   Frontend:        http://localhost:3002"
    echo "   Backend API:     http://localhost:4001"
    echo "   Supabase Studio: http://localhost:3001"
    echo "   Supabase API:    http://localhost:8000"
    echo ""
    echo "📚 To view logs: docker-compose logs -f"
    echo "🛑 To stop:      docker-compose down"
    echo "📖 See README.md for more commands"
    echo ""
else
    echo ""
    echo "👍 No problem! When you're ready, run:"
    echo "   docker-compose up -d"
    echo ""
fi

echo "🎯 Quick commands:"
echo "   make up          - Start all services"
echo "   make down        - Stop all services"
echo "   make logs        - View all logs"
echo "   make help        - See all available commands"
echo ""
echo "Happy coding! 🚀"

