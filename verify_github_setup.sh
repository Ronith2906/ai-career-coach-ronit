#!/bin/bash

echo "🔍 GitHub Setup Verification"
echo "============================"
echo ""

cd /workspace/realtime-analytics-dashboard

echo "📁 Project: realtime-analytics-dashboard"
echo "📍 Location: $(pwd)"
echo ""

echo "✅ Git Status:"
git status --short
echo ""

echo "📝 Last Commit:"
git log -1 --oneline
echo ""

echo "🌐 Remote Configuration:"
git remote -v
echo ""

echo "🌳 Current Branch:"
git branch --show-current
echo ""

echo "📊 Project Stats:"
echo "- Total files: $(git ls-files | wc -l)"
echo "- JavaScript files: $(find . -name "*.js" -not -path "./node_modules/*" | wc -l)"
echo "- Total lines of code: $(find . -name "*.js" -not -path "./node_modules/*" -exec wc -l {} + | tail -1 | awk '{print $1}')"
echo ""

if git remote -v | grep -q "origin"; then
    echo "✅ Remote 'origin' is configured"
    echo "🚀 Ready to push with: git push -u origin main"
else
    echo "❌ No remote configured yet"
    echo "💡 Run: /workspace/quick_push_to_github.sh"
fi