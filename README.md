# Elaris

A desktop application for interacting with AI models through the Model Context Protocol (MCP), built with Electron, React, and FastAPI.

## Features

- 🤖 **Multi-LLM Support**: Connect to various AI providers (OpenAI, Anthropic, etc.)
- 🔌 **MCP Integration**: Seamlessly work with MCP servers and tools
- 💬 **Rich Chat Interface**: Modern, responsive chat UI with message history
- 🛠️ **Tool Approval**: Review and approve tool calls before execution
- 📱 **Cross-Platform**: Available on macOS, Windows, and Linux
- 🎨 **Modern UI**: Clean, intuitive interface built with React

## Architecture

```
elaris/
├── frontend/          # React frontend (Vite + TypeScript)
├── server/           # FastAPI backend (Python)
├── electron/         # Electron main process
├── scripts/          # Build and deployment scripts
│   ├── build-dmg.sh  # Build script for macOS
│   └── release.sh    # Release script for GitHub
└── examples/         # Example scripts and usage
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd elaris
   ```

2. **Install Python dependencies**
   ```bash
   cd server
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

3. **Install Node.js dependencies**
   ```bash
   # Install Electron dependencies
   cd electron
   npm install
   cd ..
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

### Running in Development

1. **Start the backend server**
   ```bash
   cd server
   source venv/bin/activate
   python main.py
   ```

2. **Start the frontend and Electron app**
   ```bash
   cd electron
   npm run dev
   ```

This will start:
- FastAPI backend on port 8000
- Vite dev server on port 5173
- Electron app connecting to both

## Building for Production

### Using Makefile (Recommended)

```bash
# Build signed DMG for your architecture
make build-dmg-arm64    # For Apple Silicon Macs
make build-dmg-x64      # For Intel Macs

# Build unsigned DMG for development
make build-dmg-arm64-dev
make build-dmg-x64-dev

# Other useful commands
make install            # Install all dependencies
make dev               # Start development environment
make clean             # Clean build artifacts
make release           # Create GitHub release
make version           # Show current version
make help              # Show all available commands
```

### Manual Build (Alternative)

```bash
# Direct script usage
./scripts/build-dmg.sh --arm64 --sign
./scripts/build-dmg.sh --x64 --sign

# Or via npm
cd electron
npm run build:all
```

## Configuration

The application stores configuration in:
- **macOS**: `~/Library/Application Support/Elaris/`
- **Windows**: `%APPDATA%/Elaris/`
- **Linux**: `~/.config/Elaris/`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GNU General Public License v3 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Model Context Protocol](https://github.com/modelcontextprotocol/python-sdk)
- Powered by [FastAPI](https://fastapi.tiangolo.com/)
- Frontend built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Desktop app powered by [Electron](https://electronjs.org/)
