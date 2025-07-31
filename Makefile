.PHONY: help install install-python install-frontend install-electron dev build-dmg-arm64 build-dmg-x64 build-dmg-arm64-dev build-dmg-x64-dev clean release version check

# Default target
help:
	@echo "Elaris Build System"
	@echo "==================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  install           Install all dependencies (Python, Node.js)"
	@echo "  install-python    Setup Python venv and dependencies"
	@echo "  install-frontend  Install React frontend dependencies"
	@echo "  install-electron  Install Electron dependencies"
	@echo ""
	@echo "Development:"
	@echo "  dev               Start full development environment"
	@echo ""
	@echo "Building:"
	@echo "  build-dmg-arm64   Build ARM64 DMG (signed)"
	@echo "  build-dmg-x64     Build x64 DMG (signed)"
	@echo "  build-dmg-arm64-dev  Build ARM64 DMG (unsigned)"
	@echo "  build-dmg-x64-dev    Build x64 DMG (unsigned)"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean             Clean all build artifacts"
	@echo ""
	@echo "Release:"
	@echo "  release           Create GitHub release"
	@echo "  version           Show current version"
	@echo ""
	@echo "Utility:"
	@echo "  check             Verify all dependencies are installed"

# Setup & Installation
install: install-python install-frontend install-electron
	@echo "✅ All dependencies installed"

install-python:
	@echo "📋 Setting up Python environment..."
	cd server && python3 -m venv venv
	cd server && source venv/bin/activate && pip install -r requirements.txt
	@echo "✅ Python dependencies installed"

install-frontend:
	@echo "📋 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Frontend dependencies installed"

install-electron:
	@echo "📋 Installing Electron dependencies..."
	cd electron && npm install
	@echo "✅ Electron dependencies installed"

# Development
dev:
	@echo "🚀 Starting full development environment..."
	cd electron && npm run dev

# Building (DMG targets only)

# DMG Building (signed by default)
build-dmg-arm64:
	@echo "📱 Building ARM64 DMG (signed)..."
	./scripts/build-dmg.sh --arm64 --sign

build-dmg-x64:
	@echo "📦 Building x64 DMG (signed)..."
	./scripts/build-dmg.sh --x64 --sign

# DMG Building (development - unsigned)
build-dmg-arm64-dev:
	@echo "📱 Building ARM64 DMG (unsigned)..."
	./scripts/build-dmg.sh --arm64 --unsigned

build-dmg-x64-dev:
	@echo "📦 Building x64 DMG (unsigned)..."
	./scripts/build-dmg.sh --x64 --unsigned

# Maintenance
clean: clean-python clean-frontend
	@echo "📋 Cleaning all build artifacts..."
	rm -rf build/
	rm -rf dist/
	rm -rf node-dist/
	@echo "✅ All build artifacts cleaned"

clean-python:
	@echo "📋 Cleaning Python build files..."
	rm -rf server/build/
	rm -rf server/dist/
	rm -rf server/__pycache__/
	find server -name "*.pyc" -delete
	find server -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Python build files cleaned"

clean-frontend:
	@echo "📋 Cleaning frontend build files..."
	rm -rf frontend/dist/
	@echo "✅ Frontend build files cleaned"

# Release
release:
	@echo "🚀 Creating GitHub release..."
	./scripts/release.sh

version:
	@echo "Current version: $$(node -p "require('./electron/package.json').version")"

# Utility
check:
	@echo "🔍 Checking dependencies..."
	@command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 not found"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "❌ npm not found"; exit 1; }
	@[ -f "server/venv/bin/activate" ] || { echo "⚠️  Python venv not found - run 'make install-python'"; }
	@[ -d "frontend/node_modules" ] || { echo "⚠️  Frontend dependencies not found - run 'make install-frontend'"; }
	@[ -d "electron/node_modules" ] || { echo "⚠️  Electron dependencies not found - run 'make install-electron'"; }
	@echo "✅ Dependencies check completed"
