#!/bin/bash
#
# Luc Vincent VIP App - Deployment Script
# Deploys to 137.184.166.103 (DigitalOcean Ubuntu, Node 22, nginx, PM2)
#
# Usage: ./scripts/deploy.sh
#

set -e  # Exit on error

SERVER="root@137.184.166.103"
APP_DIR="/var/www/lv-vip-app"
PM2_APP_NAME="lv-vip-app"

echo "🚀 Déploiement de l'app VIP Luc Vincent..."
echo "   Serveur: $SERVER"
echo "   Répertoire: $APP_DIR"
echo ""

# Ensure the app directory exists on the server
echo "📁 Création du répertoire si nécessaire..."
ssh $SERVER "mkdir -p $APP_DIR"

# Pull latest code
echo "📥 Récupération du code..."
ssh $SERVER "cd $APP_DIR && git pull origin feature/vip-mvp-friday || git clone --branch feature/vip-mvp-friday https://github.com/pasquinphilippe/lv-vip-app.git ."

# Copy env file if it doesn't exist (you should have .env.production on the server)
echo "🔐 Vérification des variables d'environnement..."
ssh $SERVER "if [ ! -f $APP_DIR/.env ]; then echo '⚠️  .env file missing! Please create it manually.'; exit 1; fi"

# Install dependencies
echo "📦 Installation des dépendances..."
ssh $SERVER "cd $APP_DIR && npm ci --omit=dev"

# Generate Prisma client
echo "🗄️  Génération du client Prisma..."
ssh $SERVER "cd $APP_DIR && npx prisma generate"

# Run database migrations
echo "🗄️  Exécution des migrations..."
ssh $SERVER "cd $APP_DIR && npx prisma migrate deploy"

# Build the app
echo "🔨 Build de l'application..."
ssh $SERVER "cd $APP_DIR && npm run build"

# Restart PM2 process
echo "🔄 Redémarrage de PM2..."
ssh $SERVER "cd $APP_DIR && pm2 restart $PM2_APP_NAME || pm2 start npm --name $PM2_APP_NAME -- run start"

# Save PM2 configuration
echo "💾 Sauvegarde de la configuration PM2..."
ssh $SERVER "pm2 save"

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "🔍 Pour voir les logs:"
echo "   ssh $SERVER 'pm2 logs $PM2_APP_NAME'"
echo ""
echo "🔍 Pour vérifier le statut:"
echo "   ssh $SERVER 'pm2 status'"
