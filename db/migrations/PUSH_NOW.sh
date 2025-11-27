#!/bin/bash
# Push Publo to GitHub

echo "🚀 Pushing Publo to GitHub..."
echo ""
echo "Repository: https://github.com/PalMachulla/Publo.git"
echo ""

cd /Users/palmac/Aiakaki/Code/publo

# Check if remote is set
if git remote get-url origin > /dev/null 2>&1; then
    echo "✅ Remote origin is configured"
else
    echo "Setting up remote..."
    git remote add origin https://github.com/PalMachulla/Publo.git
fi

echo ""
echo "📝 You will be prompted for:"
echo "   Username: PalMachulla"
echo "   Password: Your GitHub Personal Access Token"
echo ""
echo "🔑 Need a token? Get one here: https://github.com/settings/tokens"
echo ""

# Push to GitHub
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! Your code is now on GitHub!"
    echo "🌐 View at: https://github.com/PalMachulla/Publo"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Deploy to Vercel (see DEPLOYMENT.md)"
    echo "   2. Enable GitHub Actions"
    echo "   3. Add collaborators if needed"
else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo "   - Wrong token/password"
    echo "   - Need to create token at: https://github.com/settings/tokens"
    echo "   - Token needs 'repo' permissions"
fi

