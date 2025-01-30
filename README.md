# DeepSeek-Coder Chat Application

## Overview

This is a modern, interactive web-based chat application powered by DeepSeek-Coder, designed to provide an intuitive interface for AI-assisted coding and conversation.


## Features

- 🤖 AI-Powered Coding Assistant
- 💬 Real-time Chat Interface
- 🌓 Light/Dark Theme Toggle
- 📋 Chat History Management
- 🖥️ Integrated Terminal Output
- 🔀 Resizable Sidebar and Terminal
- 📦 Multiple Model Support

## Prerequisites

- [Ollama](https://ollama.ai/) installed and running locally
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.8+ (for backend)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hamitcf1/deepseek-coder-chat.git
   cd deepseek-coder-chat
   ```

2. Install Ollama:
   - Visit [Ollama.ai](https://ollama.ai/) and follow the installation instructions.
   - Pull DeepSeek Coder models:
     ```bash
     ollama pull deepseek-coder
     ollama pull deepseek-r1:7b
     ```

3. Start the Ollama server:
   ```bash
   ollama serve
   ```

## Running the Application Locally

1. Start a simple HTTP server using Python:
   ```bash
   python -m http.server 8000
   ```
   or for Python 3:
   ```bash
   python3 -m http.server 8000
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:8000/index.html
   ```

3. Ensure the Ollama server is running and select your preferred model from the dropdown.

## User Interface

### Sidebar
- 📝 Create new chats
- 📤 Export/Import chat history
- 🔄 Model selection
- 🖥️ Server status indicator

### Main Chat Area
- 💬 Send and receive messages
- 🌓 Theme toggle
- 🗑️ Clear chat functionality

### Terminal
- 🖥️ Toggle terminal visibility
- 📋 View application logs
- 🧹 Clear terminal output

## Keyboard Shortcuts

- `Ctrl+Enter`: Send message
- `Alt+T`: Toggle Terminal
- `Alt+S`: Toggle Sidebar
- `Ctrl+L`: Toggle Light/Dark Theme

## Customization

Edit `styles.css` to customize:
- Color schemes
- Layout preferences
- Responsive design

## Troubleshooting

- Ensure Ollama server is running
- Check browser console for error messages
- Verify model availability in Ollama

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Ollama API
- DeepSeek Coder Models

## License

[MIT License](LICENSE)

## Contact

- Project Maintainer: Hamit Can Fındık
- Email: [hamitfindik2@gmail.com]
- Project Link: [https://github.com/hamitcf1/deepseek-coder-chat](https://github.com/hamitcf1/deepseek-coder-chat)

---

**Happy Coding! 🚀👩‍💻👨‍💻**
