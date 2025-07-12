# MCP Chatbot

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
mcp-chatbot/
├── frontend/          # React frontend (Vite + TypeScript)
├── server/           # FastAPI backend (Python)
├── electron/         # Electron main process
├── examples/         # Example scripts and usage
└── build-dmg.sh     # Build script for macOS
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
   cd mcp-chatbot
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

### macOS

```bash
./build-dmg.sh
```

This creates a DMG file in the `dist/` directory.

### Manual Build

```bash
cd electron
npm run build:all
```

## Configuration

The application stores configuration in:
- **macOS**: `~/Library/Application Support/MCP Chatbot/`
- **Windows**: `%APPDATA%/MCP Chatbot/`
- **Linux**: `~/.config/MCP Chatbot/`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Model Context Protocol](https://github.com/modelcontextprotocol/python-sdk)
- Powered by [FastAPI](https://fastapi.tiangolo.com/)
- Frontend built with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Desktop app powered by [Electron](https://electronjs.org/) 