#!/bin/bash

# Release script for Elaris - Create GitHub release locally
set -e  # Exit on any error

echo "🚀 Starting Elaris release process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "electron/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    exit 1
fi

# Check if user is authenticated with gh
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub CLI"
    exit 1
fi

# Get version from package.json
print_step "Checking version..."
PKG_VERSION=$(node -p "require('./electron/package.json').version")
echo "Package version: $PKG_VERSION"

# Check if release already exists on GitHub
print_step "Checking if release already exists..."
if gh release view "v$PKG_VERSION" &> /dev/null; then
    print_error "Release v$PKG_VERSION already exists on GitHub"
    exit 1
else
    print_success "Version v$PKG_VERSION has not been released yet"
fi

# Check if prerelease
IS_PRERELEASE=false
if echo "$PKG_VERSION" | grep -qE "(alpha|beta|rc|pre)"; then
    IS_PRERELEASE=true
    print_step "Detected prerelease version"
else
    print_step "Detected stable release version"
fi

# Check if build artifacts exist
print_step "Checking for build artifacts..."
if [ ! -d "dist" ]; then
    print_error "No dist/ directory found"
    exit 1
fi

# Find DMG and ZIP files (only in top-level dist directory)
DMG_FILES=$(find dist -maxdepth 1 -name "*.dmg" 2>/dev/null || true)
ZIP_FILES=$(find dist -maxdepth 1 -name "*.zip" 2>/dev/null || true)
YML_FILES=$(find dist -maxdepth 1 -name "latest-mac.yml" -o -maxdepth 1 -name "app-update.yml" 2>/dev/null || true)

if [ -z "$DMG_FILES" ] && [ -z "$ZIP_FILES" ]; then
    print_error "No DMG or ZIP files found in dist/"
    exit 1
fi

print_success "Found build artifacts:"
if [ -n "$DMG_FILES" ]; then
    echo "$DMG_FILES" | while read -r file; do
        echo "  📱 $(basename "$file")"
    done
fi
if [ -n "$ZIP_FILES" ]; then
    echo "$ZIP_FILES" | while read -r file; do
        echo "  📦 $(basename "$file")"
    done
fi
if [ -n "$YML_FILES" ]; then
    echo "$YML_FILES" | while read -r file; do
        echo "  📄 $(basename "$file")"
    done
fi

# Create release
print_step "Creating GitHub release..."

# Prepare gh release create command
RELEASE_CMD="gh release create v$PKG_VERSION"

# Add files to upload
if [ -n "$DMG_FILES" ]; then
    RELEASE_CMD="$RELEASE_CMD $DMG_FILES"
fi
if [ -n "$ZIP_FILES" ]; then
    RELEASE_CMD="$RELEASE_CMD $ZIP_FILES"
fi
if [ -n "$YML_FILES" ]; then
    RELEASE_CMD="$RELEASE_CMD $YML_FILES"
fi

# Add release options
RELEASE_CMD="$RELEASE_CMD --title \"Release v$PKG_VERSION\""
RELEASE_CMD="$RELEASE_CMD --generate-notes"

if [ "$IS_PRERELEASE" = true ]; then
    RELEASE_CMD="$RELEASE_CMD --prerelease"
fi

# Execute the release command
print_step "Executing: $RELEASE_CMD"
eval $RELEASE_CMD

if [ $? -eq 0 ]; then
    print_success "Release v$PKG_VERSION created successfully!"
    echo ""
    print_step "Release details:"
    echo "  🏷️  Tag: v$PKG_VERSION"
    if [ "$IS_PRERELEASE" = true ]; then
        echo "  🧪 Type: Prerelease"
    else
        echo "  🎯 Type: Stable release"
    fi
    echo "  🔗 URL: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/v$PKG_VERSION"
    echo ""
    print_success "Release is now live on GitHub"
else
    print_error "Failed to create release"
    exit 1
fi
