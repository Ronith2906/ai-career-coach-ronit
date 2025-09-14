#!/bin/bash

echo "🚀 GitHub Push Helper for Real-Time Analytics Dashboard"
echo "======================================================="

# Navigate to project directory
cd /workspace/realtime-analytics-dashboard

# Initialize git if not already initialized
if [ ! -d .git ]; then
    echo "📁 Initializing Git repository..."
    git init
    git branch -M main
fi

# Get GitHub username
echo ""
read -p "Enter your GitHub username: " GITHUB_USERNAME

# Get repository name
read -p "Enter repository name (default: realtime-analytics-dashboard): " REPO_NAME
REPO_NAME=${REPO_NAME:-realtime-analytics-dashboard}

# Add all files
echo ""
echo "📄 Adding all files to Git..."
git add .

# Create commit
echo "💾 Creating commit..."
git commit -m "feat: Real-time analytics dashboard with anomaly detection

- WebSocket real-time data streaming
- Advanced anomaly detection (Z-Score, IQR, Isolation Forest)
- D3.js interactive visualizations
- Docker containerization
- Comprehensive test suite
- Production-ready architecture"

# Add remote origin
echo ""
echo "🔗 Adding remote origin..."
git remote add origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git" 2>/dev/null || {
    echo "Remote origin already exists. Updating URL..."
    git remote set-url origin "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
}

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
echo "You may be prompted for your GitHub credentials or Personal Access Token"
git push -u origin main

echo ""
echo "✅ Complete! Your project should now be available at:"
echo "   https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo ""
echo "📝 Next steps:"
echo "   1. Add a LICENSE file (MIT recommended)"
echo "   2. Create GitHub releases"
echo "   3. Enable GitHub Actions"
echo "   4. Add project topics/tags"
echo "   5. Update your LinkedIn with the project link!"