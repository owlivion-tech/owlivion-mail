#!/bin/bash
# ============================================================================
# Owlivion Mail - OAuth2 Setup Script
# ============================================================================

set -e

echo "🔐 Owlivion Mail - OAuth2 Setup"
echo "================================"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Copy .env.example to .env
cp .env.example .env
echo "✅ Created .env file from .env.example"
echo ""

# Google OAuth2
echo "📧 Google OAuth2 Setup"
echo "----------------------"
echo "1. Go to: https://console.cloud.google.com/"
echo "2. Create a new project or select existing one"
echo "3. Enable Gmail API"
echo "4. Create OAuth 2.0 credentials (Desktop app)"
echo "5. Add redirect URI: http://localhost:8080/callback"
echo ""
read -p "Enter your Google Client ID: " google_client_id
read -p "Enter your Google Client Secret: " google_client_secret
echo ""

# Replace in .env
sed -i "s|GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$google_client_id|g" .env
sed -i "s|GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$google_client_secret|g" .env

# Microsoft OAuth2
echo "📧 Microsoft OAuth2 Setup"
echo "-------------------------"
echo "1. Go to: https://portal.azure.com/"
echo "2. Navigate to App registrations"
echo "3. Create new registration"
echo "4. Add redirect URI: http://localhost:8080/callback"
echo "5. Create client secret"
echo ""
read -p "Enter your Microsoft Client ID: " ms_client_id
read -p "Enter your Microsoft Client Secret: " ms_client_secret
echo ""

# Replace in .env
sed -i "s|MICROSOFT_CLIENT_ID=.*|MICROSOFT_CLIENT_ID=$ms_client_id|g" .env
sed -i "s|MICROSOFT_CLIENT_SECRET=.*|MICROSOFT_CLIENT_SECRET=$ms_client_secret|g" .env

echo "✅ OAuth2 credentials saved to .env"
echo ""
echo "📝 Next steps:"
echo "1. Review OAUTH_SETUP.md for detailed instructions"
echo "2. Make sure redirect URIs are configured correctly"
echo "3. Run: source .env (to load environment variables)"
echo "4. Run: pnpm tauri dev (to test)"
echo ""
echo "🎉 Setup complete!"
