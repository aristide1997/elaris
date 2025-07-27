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

# Parse command line arguments
SIGN_APP=false
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
        *)
        # unknown option
        ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "electron/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Load signing environment if available and signing is requested
if [ "$SIGN_APP" = true ]; then
    # Check if running in CI (GitHub Actions) or locally
    if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
        print_step "Running in CI environment - using imported certificate"
        # In CI, the certificate is already imported by the import-codesign-certs action
        # CODESIGN_IDENTITY should be set as an environment variable
        if [ -z "$CODESIGN_IDENTITY" ]; then
            print_error "CODESIGN_IDENTITY environment variable not set in CI"
            exit 1
        fi
        print_success "Using certificate: $CODESIGN_IDENTITY"
    else
        # Local development - load from .env.signing
        if [ -f ".env.signing" ]; then
            print_step "Loading signing configuration..."
            source .env.signing
            print_success "Signing configuration loaded"
            
            # Verify certificate exists
            if [ -n "$KEYCHAIN_NAME" ]; then
                if ! security find-identity -v -p codesigning "$KEYCHAIN_NAME" | grep -q "$CODESIGN_IDENTITY"; then
                    print_error "Certificate '$CODESIGN_IDENTITY' not found in keychain '$KEYCHAIN_NAME'"
                    print_warning "Run './create-certificate.sh' first to create the certificate"
                    exit 1
                fi
                # Unlock keychain
                security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"
                print_success "Keychain unlocked"
            else
                # Check in default keychains
                if ! security find-identity -v -p codesigning | grep -q "$CODESIGN_IDENTITY"; then
                    print_error "Certificate '$CODESIGN_IDENTITY' not found in default keychains"
                    print_warning "Please check that the certificate exists and is trusted for code signing"
                    exit 1
                fi
                print_success "Certificate found in default keychain"
            fi
        else
            print_error "Signing requested but .env.signing file not found"
            print_warning "Run './create-certificate.sh' first to create the certificate"
            exit 1
        fi
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
NODE_DIST="node-${NODE_VERSION}-darwin-x64"
rm -rf node-dist
mkdir -p node-dist
curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz" \
    | tar -xz --strip-components=1 -C node-dist
print_success "Embedded Node.js ${NODE_VERSION} downloaded into node-dist/"

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

if [ "$SIGN_APP" = true ]; then
    print_step "Building SIGNED DMG and ZIP with certificate: $CODESIGN_IDENTITY"
    # Enable code signing with our certificate
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    export CSC_NAME="$CODESIGN_IDENTITY"
    export CSC_KEYCHAIN="$KEYCHAIN_NAME"
    npx electron-builder --mac --x64 -c.mac.identity="$CODESIGN_IDENTITY"
else
    print_step "Building UNSIGNED DMG and ZIP..."
    # Disable automatic code-signing discovery so the app remains unsigned
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    # Build unsigned DMG and ZIP by overriding mac.identity to null
    npx electron-builder --mac --x64 -c.mac.identity=null
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
echo "  📱 DMG file: dist/ (for initial installation)"
echo "  📦 ZIP file: dist/ (for auto-updates)"
echo "  🐍 Python executable: build/elaris-backend"
echo "  ⚛️  React build: frontend/dist/"
if [ "$SIGN_APP" = true ]; then
    echo "  🔐 Code signing: Enabled (Self-signed)"
else
    echo "  🔓 Code signing: Disabled"
fi
echo ""

if [ "$SIGN_APP" = true ]; then
    print_success "You can now distribute the signed DMG and ZIP files!"
    print_warning "Note: Self-signed apps will show security warnings to users"
    echo "       Users need to right-click and 'Open' to bypass Gatekeeper"
else
    print_success "You can now distribute the unsigned DMG and ZIP files!"
    print_warning "Note: Unsigned apps will show security warnings to users"
fi

echo ""
print_step "Usage:"
echo "  • Unsigned build: ./build-dmg.sh --unsigned"
echo "  • Signed build:   ./build-dmg.sh --sign"
