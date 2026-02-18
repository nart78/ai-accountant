#!/bin/bash
# One-shot deployment script for Ubuntu VPS
# Run this on your VPS after cloning the repo
set -e

echo "🚀 AI Accountant — VPS Deployment Script"
echo "========================================="

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. You may need to log out and back in for group changes."
else
    echo "✅ Docker already installed: $(docker --version)"
fi

# 2. Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose plugin..."
    sudo apt-get update -qq
    sudo apt-get install -y docker-compose-plugin
fi

echo "✅ Docker Compose: $(docker compose version)"

# 3. Check .env file
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.production.example .env
    echo ""
    echo "❗ IMPORTANT: Edit .env before continuing:"
    echo "   nano .env"
    echo ""
    echo "   You must set:"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - DB_PASSWORD"
    echo "   - SECRET_KEY  (run: openssl rand -hex 32)"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# 4. Check Caddyfile has real domain
if grep -q "yourdomain.com" Caddyfile; then
    echo ""
    echo "❗ IMPORTANT: Update Caddyfile with your actual domain:"
    echo "   nano Caddyfile"
    echo "   Replace 'yourdomain.com' with your domain"
    echo ""
    read -p "Press Enter after editing Caddyfile to continue..."
fi

# 5. Build and start
echo ""
echo "🔨 Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your AI Accountant is running at https://$(grep -oP '(?<=\n|^)[a-z0-9.-]+(?=\s*\{)' Caddyfile | head -1)"
echo ""
echo "Useful commands:"
echo "  View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:         docker compose -f docker-compose.prod.yml down"
echo "  Restart:      docker compose -f docker-compose.prod.yml restart"
echo "  Update:       git pull && docker compose -f docker-compose.prod.yml up -d --build"
