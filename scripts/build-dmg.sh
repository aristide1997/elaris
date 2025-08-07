#!/bin/bash

# Build script for Elaris DMG with optional code signing
set -e  # Exit on any error

echo "🚀 Starting Elaris DMG build process..."

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

prune_node_runtime() {
    local node_dist_path="$1"
    
    print_step "Aggressively pruning Node.js runtime to slim ${node_dist_path}…"
    
    # Remove NPM documentation and test files
    rm -rf "${node_dist_path}/lib/node_modules/npm/{doc,html,man,test,changelogs,tap-snapshots}"
    
    # Remove nested test directories and documentation in npm dependencies
    find "${node_dist_path}/lib/node_modules/npm/node_modules" -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
    find "${node_dist_path}/lib/node_modules/npm/node_modules" -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
    find "${node_dist_path}/lib/node_modules/npm/node_modules" -name "*.md" -type f -delete 2>/dev/null || true
    find "${node_dist_path}/lib/node_modules/npm/node_modules" -name "README*" -type f -delete 2>/dev/null || true
    
    # Remove C++ headers (not needed for runtime)
    rm -rf "${node_dist_path}/include/"
    
    # Remove docs, man pages, and other shared resources
    rm -rf "${node_dist_path}/share/"
    
    # Remove systemtap/dtrace files (debugging)
    rm -rf "${node_dist_path}/lib/dtrace/" 2>/dev/null || true
    
    # Clean npm cache and temporary files
    rm -rf "${node_dist_path}/lib/node_modules/npm/.cache/" 2>/dev/null || true
    rm -rf "${node_dist_path}/lib/node_modules/npm/tmp/" 2>/dev/null || true
    
    # Strip the node binary
    strip "${node_dist_path}/bin/node"
    
    print_success "Aggressively pruned Node.js runtime and stripped node binary"
}

# Parse command line arguments
SIGN_APP=false
BUILD_ARCH=""
for arg in "$@"
do
    case $arg in
        --sign)
        SIGN_APP=true
        shift
        ;;
        --unsigned)
        SIGN_APP=false
        shift
        ;;
        --x64)
        BUILD_ARCH="--x64"
        shift
        ;;
        --arm64)
        BUILD_ARCH="--arm64"
        shift
        ;;
        *)
        # unknown option
        ;;
    esac
done

# Change to project root directory (one level up from scripts/)
cd "$(dirname "$0")/.."

# Check if we're in the right directory
if [ ! -f "electron/package.json" ]; then
    print_error "Could not find electron/package.json. Please ensure the script is in the scripts/ directory of the project."
    exit 1
fi

# Check if architecture is specified
if [ -z "$BUILD_ARCH" ]; then
    print_error "Architecture must be specified: --x64 or --arm64"
    print_step "Usage: $0 [--x64|--arm64] [--sign|--unsigned]"
    exit 1
fi

# Load signing environment if available and signing is requested
if [ "$SIGN_APP" = true ]; then
    # Load from .env.signing
    if [ -f ".env.signing" ]; then
        print_step "Loading signing configuration..."
        source .env.signing
        print_success "Signing configuration loaded"
        
        # Verify certificate exists
        if [ -n "$KEYCHAIN_NAME" ]; then
            if ! security find-identity -v -p codesigning "$KEYCHAIN_NAME" | grep -q "$CODESIGN_IDENTITY"; then
                print_error "Certificate '$CODESIGN_IDENTITY' not found in keychain '$KEYCHAIN_NAME'"
                exit 1
            fi
            # Unlock keychain
            security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"
            print_success "Keychain unlocked"
        else
            # Check in default keychains
            if ! security find-identity -v -p codesigning | grep -q "$CODESIGN_IDENTITY"; then
                print_error "Certificate '$CODESIGN_IDENTITY' not found in default keychains"
                exit 1
            fi
            print_success "Certificate found in default keychain"
        fi
    else
        print_error "Signing requested but .env.signing file not found"
        exit 1
    fi
fi

# Clean previous builds
print_step "Cleaning previous builds..."
rm -rf build/
rm -rf dist/
rm -rf frontend/dist/
print_success "Cleaned previous builds"

# Step 0: Download Node.js runtime for embedded npx
print_step "Downloading embedded Node.js runtime..."
NODE_VERSION="v20.10.0"
# Set Node.js architecture based on build target
if [ "$BUILD_ARCH" = "--arm64" ]; then
    NODE_ARCH="arm64"
else
    NODE_ARCH="x64"
fi
NODE_DIST="node-${NODE_VERSION}-darwin-${NODE_ARCH}"
rm -rf node-dist
mkdir -p node-dist
curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz" \
    | tar -xz --strip-components=1 -C node-dist
print_success "Embedded Node.js ${NODE_VERSION} (${NODE_ARCH}) downloaded into node-dist/"

# Prune the Node.js runtime to reduce size
prune_node_runtime "node-dist"

# Step 1: Install Python dependencies and build Python executable
print_step "Building Python backend with PyInstaller..."
cd server

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    print_step "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
print_step "Installing Python dependencies..."
pip install -r requirements.txt

# Build with PyInstaller
print_step "Creating Python executable..."
pyinstaller main.spec --distpath ../build --workpath ../build/temp --clean

cd ..
print_success "Python backend built successfully"

# Step 2: Install Node.js dependencies for electron
print_step "Installing Electron dependencies..."
cd electron
npm install
print_success "Electron dependencies installed"
cd ..

# Step 3: Install and build React frontend
print_step "Building React frontend..."
cd frontend
npm install
npm run build
cd ..
print_success "React frontend built successfully"

cd electron
# Step 4: Build Electron app and create DMG
print_step "Building Electron app and creating DMG..."

# Set the target architecture for electron-builder
if [ "$BUILD_ARCH" = "--arm64" ]; then
    ELECTRON_ARCH="arm64"
else
    ELECTRON_ARCH="x64"
fi

if [ "$SIGN_APP" = true ]; then
    # Enable code signing with our certificate
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    export CSC_NAME="$CODESIGN_IDENTITY"
    export CSC_KEYCHAIN="$KEYCHAIN_NAME"
    
    if [ "$BUILD_ARCH" = "--x64" ]; then
        print_step "Building SIGNED ZIP for ${ELECTRON_ARCH} with certificate: $CODESIGN_IDENTITY"
        npx electron-builder --mac $BUILD_ARCH -c.mac.target=zip -c.mac.identity="$CODESIGN_IDENTITY"
    else
        print_step "Building SIGNED DMG and ZIP for ${ELECTRON_ARCH} with certificate: $CODESIGN_IDENTITY"
        npx electron-builder --mac $BUILD_ARCH -c.mac.identity="$CODESIGN_IDENTITY"
    fi
else
    # Disable automatic code-signing discovery so the app remains unsigned
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    
    if [ "$BUILD_ARCH" = "--x64" ]; then
        print_step "Building UNSIGNED ZIP for ${ELECTRON_ARCH}..."
        npx electron-builder --mac $BUILD_ARCH -c.mac.target=zip -c.mac.identity=null
    else
        print_step "Building UNSIGNED DMG and ZIP for ${ELECTRON_ARCH}..."
        npx electron-builder --mac $BUILD_ARCH -c.mac.identity=null
    fi
fi

cd ..

if [ "$SIGN_APP" = true ]; then
    print_success "Signed DMG and ZIP created successfully!"
else
    print_success "Unsigned DMG and ZIP created successfully!"
fi

# Display results
echo ""
echo "🎉 Build completed!"
echo ""
print_success "Your build files are located in: dist/"

# Check if the app is signed
if [ "$SIGN_APP" = true ]; then
    print_step "Verifying code signature..."
    if codesign -dv --verbose=4 "dist/mac/Elaris.app" 2>/dev/null; then
        print_success "App is properly code signed"
    else
        print_warning "App signature verification failed"
    fi
fi

echo ""
print_step "Build artifacts:"
if [ "$BUILD_ARCH" = "--x64" ]; then
    echo "  📦 ZIP file: dist/ (Intel - for distribution and auto-updates)"
else
    echo "  📱 DMG file: dist/ (ARM - for initial installation)"
    echo "  📦 ZIP file: dist/ (ARM - for auto-updates)"
fi
echo "  🐍 Python executable: build/elaris-backend"
echo "  ⚛️  React build: frontend/dist/"
if [ "$SIGN_APP" = true ]; then
    echo "  🔐 Code signing: Enabled (Self-signed)"
else
    echo "  🔓 Code signing: Disabled"
fi
echo ""

if [ "$BUILD_ARCH" = "--x64" ]; then
    if [ "$SIGN_APP" = true ]; then
        print_success "Signed ZIP file ready for Intel distribution"
    else
        print_success "Unsigned ZIP file ready for Intel distribution"
    fi
else
    if [ "$SIGN_APP" = true ]; then
        print_success "Signed DMG and ZIP files ready for ARM distribution"
    else
        print_success "Unsigned DMG and ZIP files ready for ARM distribution"
    fi
fi
