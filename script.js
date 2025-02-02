class OllamaChat {
    constructor() {
        // Initialize UI elements
        this.messages = document.getElementById('messages');
        this.promptInput = document.getElementById('prompt-input');
        this.sendButton = document.getElementById('send-button');
        this.statusDot = document.querySelector('.status-dot');
        this.statusText = document.querySelector('.status-text');
        this.chatList = document.getElementById('chat-list');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.restartServerBtn = document.getElementById('restart-server');
        this.terminal = document.getElementById('terminal');
        this.terminalContent = document.getElementById('terminal-content');
        this.toggleTerminalBtn = document.getElementById('toggle-terminal');
        this.toggleThinkingBtn = document.getElementById('toggle-thinking');
        this.toggleSidebarBtn = document.getElementById('toggle-sidebar');
        this.clearTerminalBtn = document.getElementById('clear-terminal');
        this.exportChatsBtn = document.getElementById('export-chats');
        this.importChatsBtn = document.getElementById('import-chats');
        this.importFileInput = document.getElementById('import-file');
        this.themeToggleBtn = document.getElementById('theme-toggle');
        this.modelSelect = document.getElementById('model-select');
        this.contentContainer = document.querySelector('.content-container');
        this.appContainer = document.querySelector('.app-container');
        this.sidebarResizeHandle = document.querySelector('.sidebar-resize-handle');
        this.terminalResizeHandle = document.querySelector('.terminal-resize-handle');
        this.sidebar = document.querySelector('.sidebar');
        this.mainContent = document.querySelector('.main-content');

        // Initialize state
        this.chats = {};
        this.currentChatId = null;
        this.currentModel = localStorage.getItem('selectedModel') || 'deepseek-r1:7b';
        this.currentRequest = null;
        this.maxMessages = 100;
        this.isProcessing = false;
        this.serverAvailable = false;
        this.showThinking = localStorage.getItem('showThinking') === 'true';

        // Initialize theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (this.themeToggleBtn) {
            this.themeToggleBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
        }

        // Initialize thinking process toggle
        if (this.toggleThinkingBtn) {
            this.toggleThinkingBtn.classList.toggle('active', this.showThinking);
            this.toggleThinkingBtn.setAttribute('aria-pressed', this.showThinking);
            this.toggleThinkingBtn.title = this.showThinking ? 'Hide Thinking Process' : 'Show Thinking Process';
        }

        // Initialize model selector
        if (this.modelSelect) {
            this.modelSelect.value = this.currentModel;
        }

        // Load saved chats
        this.loadChats();
        
        // Initialize UI state
        this.initializeUIState();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check server and model availability
        this.checkServerAvailability();
    }

    initializeUIState() {
        // Initialize sidebar state from localStorage
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            this.sidebar?.classList.add('collapsed');
            this.mainContent?.classList.add('expanded');
            this.toggleSidebarBtn?.setAttribute('aria-pressed', 'true');
            this.toggleSidebarBtn.title = 'Show Sidebar';
        }

        // Initialize terminal visibility
        const terminalVisible = localStorage.getItem('terminalVisible') === 'true';
        if (terminalVisible) {
            this.showTerminal();
        } else {
            this.hideTerminal();
        }

        // Load saved dimensions
        const savedSidebarWidth = localStorage.getItem('sidebarWidth');
        const savedTerminalHeight = localStorage.getItem('terminalHeight');

        if (savedSidebarWidth && this.sidebar) {
            this.sidebar.style.width = savedSidebarWidth + 'px';
            this.mainContent.style.marginLeft = savedSidebarWidth + 'px';
        }

        if (savedTerminalHeight && this.terminal) {
            this.terminal.style.height = savedTerminalHeight + 'px';
            if (this.contentContainer) {
                this.contentContainer.style.height = `calc(100vh - ${savedTerminalHeight + 80}px)`;
            }
        }
    }

    setupEventListeners() {
        // Chat controls
        this.newChatBtn?.addEventListener('click', () => this.createNewChat());
        this.clearChatBtn?.addEventListener('click', () => this.clearCurrentChat());
        this.sendButton?.addEventListener('click', () => this.sendMessage());
        this.promptInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Terminal controls
        this.toggleTerminalBtn?.addEventListener('click', () => {
            this.terminal?.classList.toggle('visible');
            this.saveUIState();
        });

        this.clearTerminalBtn?.addEventListener('click', () => {
            if (this.terminalContent) {
                this.terminalContent.innerHTML = '';
            }
        });

        // Thinking toggle
        this.toggleThinkingBtn?.addEventListener('click', () => {
            this.toggleThinkingProcess();
        });

        // Clear chat
        this.clearChatBtn?.addEventListener('click', () => {
            if (this.isProcessing) return;
            if (this.messages) {
                this.messages.innerHTML = '';
            }
            if (this.currentChatId) {
                this.chats[this.currentChatId].messages = [];
                this.saveChats();
            }
        });

        // Chat input
        this.promptInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Model selection
        this.modelSelect?.addEventListener('change', async (event) => {
            const selectedModel = event.target.value;
            this.log(`Checking availability for model: ${selectedModel}`, 'info');
            await this.checkModelAvailability();
            this.updateModelStatus(this.serverAvailable);
        });

        // Theme toggle
        this.themeToggleBtn?.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            this.themeToggleBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
        });

        // Server restart
        this.restartServerBtn?.addEventListener('click', async () => {
            try {
                this.log('Attempting to restart Ollama server...', 'info');
                
                // First try to shutdown gracefully
                try {
                    const response = await fetch('http://localhost:11434/api/shutdown', {
                        method: 'POST'
                    });
                    if (response.ok) {
                        this.log('Server shutdown initiated', 'info');
                    }
                } catch (error) {
                    // If server is already down, that's fine
                    this.log('Server appears to be already down', 'info');
                }

                // Wait a moment for the process to fully stop
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Try to start the server using the command line
                const startServer = async () => {
                    try {
                        await fetch('http://localhost:11434/api/tags');
                        this.log('Server is back online!', 'success');
                        await this.checkServerAvailability();
                    } catch (error) {
                        this.log('Waiting for server to start...', 'info');
                        setTimeout(startServer, 1000);
                    }
                };

                this.log('Starting server...', 'info');
                startServer();
                
            } catch (error) {
                this.log('Failed to restart server: ' + error.message, 'error');
            }
        });

        // Initialize resize handlers
        this.initResizeHandlers();

        // Sidebar toggle
        this.toggleSidebarBtn?.addEventListener('click', () => {
            this.toggleSidebar();
        });
    }

    async checkServerAvailability() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (!response.ok) throw new Error('Server returned ' + response.status);
            
            const data = await response.json();
            this.serverAvailable = true;
            this.log('Connected to Ollama server', 'success');
            
            // Update model list
            if (data.models && this.modelSelect) {
                const availableModels = data.models.map(m => m.name);
                Array.from(this.modelSelect.options).forEach(option => {
                    const isAvailable = availableModels.includes(option.value);
                    option.disabled = !isAvailable;
                    if (!isAvailable) {
                        option.text += ' (not installed)';
                    }
                });
            }
            
            this.checkModelAvailability();
        } catch (error) {
            this.serverAvailable = false;
            this.log('Failed to connect to Ollama server. Is it running?', 'error');
            this.updateModelStatus(false);
            if (this.modelSelect) {
                this.modelSelect.disabled = true;
            }
            if (this.sendButton) {
                this.sendButton.disabled = true;
            }
        }
    }

    async checkModelAvailability() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (!response.ok) throw new Error('Server returned ' + response.status);
            
            const data = await response.json();
            const availableModelNames = data.models.map(m => m.name);
            const isCurrentModelAvailable = availableModelNames.includes(this.currentModel);

            this.updateModelStatus(isCurrentModelAvailable);
            this.log(`Model ${this.currentModel} is ${isCurrentModelAvailable ? 'available' : 'not available'}.`, isCurrentModelAvailable ? 'success' : 'error');

            return isCurrentModelAvailable;
        } catch (error) {
            this.updateModelStatus(false);
            this.log('Failed to check model availability: ' + error.message, 'error');
            return false;
        }
    }

    getModelDisplayName(modelValue) {
        const modelMap = {
            'deepseek-r1:7b': 'DeepSeek R1 7B',
            'deepseek-coder': 'DeepSeek Coder'
        };
        return modelMap[modelValue] || modelValue;
    }

    updateModelStatus(available) {
        if (this.statusDot && this.statusText) {
            this.statusDot.style.backgroundColor = available ? 'var(--success-color)' : 'var(--danger-color)';
            this.statusText.textContent = available ? 'All systems go! Model is ready.' : 'No model available. Please install.';
            this.statusText.style.color = available ? 'var(--success-color)' : 'var(--danger-color)';
        }
        if (this.sendButton) {
            this.sendButton.disabled = !available;
        }
        if (this.promptInput) {
            this.promptInput.disabled = !available;
        }
    }

    loadChats() {
        try {
            const savedChats = localStorage.getItem('ollama-chats');
            if (savedChats) {
                this.chats = JSON.parse(savedChats);
                // Load the last active chat if it exists
                const lastActiveChat = localStorage.getItem('last-active-chat');
                if (lastActiveChat && this.chats[lastActiveChat]) {
                    this.switchToChat(lastActiveChat);
                }
            } else {
                this.chats = {};
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            this.chats = {};
        }
    }

    renderCurrentChat() {
        if (!this.messages || !this.currentChatId) return;
        
        this.messages.innerHTML = '';
        const chat = this.chats[this.currentChatId];
        
        if (!chat || !chat.messages) return;
        
        chat.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;
            
            // Create content div
            const contentDiv = document.createElement('div');
            contentDiv.className = 'content';
            contentDiv.innerHTML = this.formatMessage(msg.content);
            messageDiv.appendChild(contentDiv);
            
            // Add thinking process div for assistant messages
            if (msg.role === 'assistant' && msg.thinking) {
                const thinkDiv = document.createElement('div');
                thinkDiv.className = 'think-process' + (this.showThinking ? ' visible' : '');
                thinkDiv.textContent = msg.thinking;
                messageDiv.insertBefore(thinkDiv, contentDiv);
            }
            
            this.messages.appendChild(messageDiv);
        });
        
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    switchToChat(chatId) {
        if (!this.chats[chatId]) return;
        
        this.currentChatId = chatId;
        localStorage.setItem('last-active-chat', chatId);
        
        // Update model selector to match chat's model
        if (this.modelSelect && this.chats[chatId].model) {
            this.modelSelect.value = this.chats[chatId].model;
            this.currentModel = this.chats[chatId].model;
        }
        
        this.renderCurrentChat();
        this.renderChatList();
    }

    createNewChat() {
        const chatId = Date.now().toString();
        this.chats[chatId] = {
            id: chatId,
            title: 'New Chat',
            model: this.currentModel,
            created: Date.now(),
            messages: []
        };
        this.currentChatId = chatId;
        this.renderChatList();
        this.saveChats();
    }

    addMessage(content, isUser = false, isError = false) {
        if (!this.currentChatId) {
            this.createNewChat();
        }

        const chat = this.chats[this.currentChatId];
        if (!chat.messages) {
            chat.messages = [];
        }

        const messageObj = {
            role: isUser ? 'user' : (isError ? 'error' : 'assistant'),
            content: content,
            timestamp: Date.now()
        };

        chat.messages.push(messageObj);
        this.saveChats();
        this.renderCurrentChat();
    }

    formatMessage(message) {
        // Convert markdown-style code blocks
        message = message.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            return `<pre class="code-block ${language}"><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });

        // Convert inline code
        message = message.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert URLs to links
        message = message.replace(
            /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        // Convert bold text
        message = message.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Convert italic text
        message = message.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Convert bullet points
        message = message.replace(/^- (.+)$/gm, '<li>$1</li>');
        message = message.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        return message;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async sendMessage() {
        if (!this.promptInput || this.isProcessing) return;
        
        const prompt = this.promptInput.value.trim();
        if (!prompt) return;
        
        // Create new chat if needed
        if (!this.currentChatId) {
            this.createNewChat();
        }
        
        this.isProcessing = true;
        const originalPrompt = prompt;
        this.promptInput.value = '';
        
        try {
            // Create user message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user';
            const userContent = document.createElement('div');
            userContent.className = 'content';
            userContent.innerHTML = this.formatMessage(originalPrompt);
            userMessageDiv.appendChild(userContent);
            this.messages?.appendChild(userMessageDiv);
            
            // Save user message
            this.chats[this.currentChatId].messages.push({
                role: 'user',
                content: originalPrompt,
                timestamp: Date.now()
            });
            this.saveChats();
            
            // Create assistant message container
            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'message assistant';
            this.messages?.appendChild(assistantMessageDiv);
            
            // Add thinking process
            const thinkDiv = document.createElement('div');
            thinkDiv.className = 'think-process' + (this.showThinking ? ' visible' : '');
            thinkDiv.textContent = 'Analyzing your request...';
            assistantMessageDiv.appendChild(thinkDiv);
            
            // Add response container
            const responseDiv = document.createElement('div');
            responseDiv.className = 'content';
            assistantMessageDiv.appendChild(responseDiv);
            
            // Scroll to latest message
            this.messages.scrollTop = this.messages.scrollHeight;
            
            let currentThinkProcess = '';
            let fullResponse = '';
            let isThinkProcess = false;
            
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.currentModel,
                    prompt: originalPrompt,
                    stream: true
                })
            });
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (!line) continue;
                    
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.response) {
                            if (data.response.includes('<think>')) {
                                isThinkProcess = true;
                                currentThinkProcess = data.response.replace('<think>', '');
                                if (thinkDiv) {
                                    thinkDiv.textContent = currentThinkProcess;
                                    thinkDiv.classList.toggle('visible', this.showThinking);
                                }
                            } else if (data.response.includes('</think>')) {
                                isThinkProcess = false;
                            } else if (!isThinkProcess) {
                                fullResponse += data.response;
                                responseDiv.innerHTML = this.formatMessage(fullResponse);
                                this.messages.scrollTop = this.messages.scrollHeight;
                            } else if (this.showThinking) {
                                currentThinkProcess += data.response;
                                if (thinkDiv) {
                                    thinkDiv.textContent = currentThinkProcess;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing response:', error);
                    }
                }
            }
            
            // Save assistant message
            if (fullResponse) {
                this.chats[this.currentChatId].messages.push({
                    role: 'assistant',
                    content: fullResponse,
                    thinking: currentThinkProcess,
                    timestamp: Date.now()
                });
                this.saveChats();
            }
            
        } catch (error) {
            console.error('Error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            const errorContent = document.createElement('div');
            errorContent.className = 'content';
            errorContent.textContent = 'An error occurred while processing your request. Please try again.';
            errorDiv.appendChild(errorContent);
            this.messages?.appendChild(errorDiv);
        } finally {
            this.isProcessing = false;
        }
    }

    saveChats() {
        try {
            const chatsToSave = {};
            // Only save necessary data and ensure proper structure
            for (const [id, chat] of Object.entries(this.chats)) {
                chatsToSave[id] = {
                    id: chat.id,
                    title: chat.title || 'New Chat',
                    model: chat.model || this.currentModel,
                    messages: (chat.messages || []).map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        thinking: msg.thinking,
                        timestamp: msg.timestamp
                    }))
                };
            }
            localStorage.setItem('ollama-chats', JSON.stringify(chatsToSave));
            localStorage.setItem('last-active-chat', this.currentChatId);
        } catch (error) {
            console.error('Error saving chats:', error);
        }
    }

    renderChatList() {
        if (!this.chatList) return;
        this.chatList.innerHTML = '';

        // Sort chats by creation time, most recent first
        const sortedChatIds = Object.keys(this.chats)
            .sort((a, b) => this.chats[b].created - this.chats[a].created);

        sortedChatIds.forEach(chatId => {
            const chat = this.chats[chatId];
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.setAttribute('data-chat-id', chatId);
            
            // Show model information in chat title
            const titleText = chat.title || 'Untitled Chat';
            const modelInfo = chat.model || 'Unknown Model';
            const createdDate = chat.created ? new Date(chat.created).toLocaleString() : 'Unknown Date';
            
            chatItem.innerHTML = `
                <div class="chat-title">${titleText}</div>
                <div class="chat-model-info">🤖 ${modelInfo}</div>
                <div class="chat-timestamp">${createdDate}</div>
                <button class="delete-chat-btn">🗑️</button>
            `;

            chatItem.querySelector('.delete-chat-btn')?.addEventListener('click', () => {
                this.deleteChat(chatId);
            });

            chatItem.addEventListener('click', () => {
                this.switchToChat(chatId);
            });

            this.chatList.appendChild(chatItem);
        });
    }

    deleteChat(chatId) {
        if (this.isProcessing) return;

        delete this.chats[chatId];
        if (this.currentChatId === chatId) {
            this.currentChatId = null;
            this.clearMessages();
        }
        this.saveChats();
        this.renderChatList();
        this.log(`Deleted chat: ${chatId}`, 'info');
    }

    clearMessages() {
        if (this.messages) {
            this.messages.innerHTML = '';
        }
    }

    log(message, level = 'info') {
        if (!this.terminalContent) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `log-${level}`;
        messageDiv.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

        this.terminalContent.appendChild(messageDiv);
        this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
    }

    clearTerminal() {
        if (this.terminalContent) {
            this.terminalContent.innerHTML = '';
        }
    }

    toggleTerminal() {
        if (this.terminal.classList.contains('visible')) {
            this.hideTerminal();
        } else {
            this.showTerminal();
        }
        localStorage.setItem('terminalVisible', this.terminal.classList.contains('visible'));
    }

    showTerminal() {
        this.terminal.classList.add('visible');
        this.contentContainer.style.height = `calc(100vh - ${this.terminal.offsetHeight + 80}px)`;
        this.toggleTerminalBtn.innerHTML = '🖥️ Hide';
        if (this.terminalResizeHandle) {
            this.terminalResizeHandle.style.pointerEvents = 'auto';
            this.terminalResizeHandle.style.opacity = '1';
        }
    }

    hideTerminal() {
        this.terminal.classList.remove('visible');
        this.contentContainer.style.height = 'calc(100vh - 80px)';
        this.toggleTerminalBtn.innerHTML = '🖥️ Show';
        if (this.terminalResizeHandle) {
            this.terminalResizeHandle.style.pointerEvents = 'none';
            this.terminalResizeHandle.style.opacity = '0';
        }
    }

    toggleSidebar() {
        if (!this.sidebar || !this.mainContent) return;
        
        // Toggle classes
        this.sidebar.classList.toggle('collapsed');
        this.mainContent.classList.toggle('expanded');
        
        // Store preference
        const isCollapsed = this.sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        
        // Update button state
        if (this.toggleSidebarBtn) {
            this.toggleSidebarBtn.setAttribute('aria-pressed', isCollapsed);
            this.toggleSidebarBtn.title = isCollapsed ? 'Show Sidebar' : 'Hide Sidebar';
        }
    }

    toggleThinkingProcess() {
        this.showThinking = !this.showThinking;
        localStorage.setItem('showThinking', this.showThinking);
        document.querySelectorAll('.think-process').forEach(el => {
            el.classList.toggle('visible', this.showThinking);
        });
    }

    addThinkingProcess(chatId, message) {
        const chat = this.chats[chatId];
        if (!chat) return;

        const thinkDiv = document.createElement('div');
        thinkDiv.className = 'think-process' + (this.showThinking ? ' visible' : '');
        thinkDiv.textContent = message;
        
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatItem) {
            chatItem.appendChild(thinkDiv);
        }
    }

    initResizeHandlers() {
        if (this.sidebarResizeHandle && this.sidebar) {
            let isResizing = false;
            let startX;
            let startWidth;

            this.sidebarResizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.pageX;
                startWidth = parseInt(getComputedStyle(this.sidebar).width, 10);
                document.body.classList.add('resizing');
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const width = startWidth + (e.pageX - startX);
                if (width >= 200 && width <= 600) {  // Min and max width
                    this.sidebar.style.width = `${width}px`;
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.classList.remove('resizing');
            });
        }

        if (this.terminalResizeHandle && this.terminal) {
            let isResizing = false;
            let startY;
            let startHeight;

            this.terminalResizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.pageY;
                startHeight = parseInt(getComputedStyle(this.terminal).height, 10);
                document.body.classList.add('resizing');
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const height = startHeight - (e.pageY - startY);
                if (height >= 100 && height <= window.innerHeight * 0.8) {  // Min and max height
                    this.terminal.style.height = `${height}px`;
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.classList.remove('resizing');
            });
        }
    }

    saveUIState() {
        localStorage.setItem('terminalVisible', this.terminal?.classList.contains('visible'));
        localStorage.setItem('showThinking', this.showThinking);
        localStorage.setItem('selectedModel', this.currentModel);
        localStorage.setItem('theme', document.documentElement.getAttribute('data-theme'));
    }
}

// Initialize the chat when the page loads
const chat = new OllamaChat();
