#!/bin/bash

echo "🚀 Quick GitHub Push for Real-Time Analytics Dashboard"
echo "====================================================="
echo ""
echo "📁 Project: realtime-analytics-dashboard"
echo "✅ Status: Ready to push (all files committed)"
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

echo ""
echo "📝 Setting up GitHub remote..."
cd /workspace/realtime-analytics-dashboard

# Add remote
git remote add origin "https://github.com/${GITHUB_USERNAME}/realtime-analytics-dashboard.git" 2>/dev/null || {
    echo "⚠️  Remote already exists. Updating..."
    git remote set-url origin "https://github.com/${GITHUB_USERNAME}/realtime-analytics-dashboard.git"
}

echo "🚀 Pushing to GitHub..."
echo ""
echo "📌 NOTE: Use your Personal Access Token as password (not your GitHub password)"
echo "   To create token: GitHub → Settings → Developer settings → Personal access tokens"
echo ""

# Push to GitHub
git push -u origin main

echo ""
echo "✨ If successful, your project is now live at:"
echo "   https://github.com/${GITHUB_USERNAME}/realtime-analytics-dashboard"
echo ""
echo "🎯 Next steps:"
echo "   1. Make sure repository is PUBLIC (not private)"
echo "   2. Add repository topics for better discovery"
echo "   3. Pin to your GitHub profile"
echo "   4. Add link to your LinkedIn post!"