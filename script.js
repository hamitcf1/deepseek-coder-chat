class OllamaChat {
    constructor() {
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
        
        this.currentChatId = null;
        this.chats = this.loadChats();
        this.currentModel = localStorage.getItem('selectedModel') || 'deepseek-coder';
        
        // Initialize terminal visibility
        const terminalVisible = localStorage.getItem('terminalVisible') === 'true';
        if (terminalVisible) {
            this.showTerminal();
        }
        
        // Initialize sidebar visibility
        const sidebarVisible = localStorage.getItem('sidebarVisible') !== 'false';
        if (!sidebarVisible) {
            this.appContainer.classList.add('sidebar-hidden');
        }
        
        // Load saved dimensions
        const savedSidebarWidth = localStorage.getItem('sidebarWidth');
        const savedTerminalHeight = localStorage.getItem('terminalHeight');
        
        if (savedSidebarWidth) {
            this.sidebar.style.width = savedSidebarWidth + 'px';
            this.sidebarResizeHandle.style.left = savedSidebarWidth + 'px';
        }
        
        if (savedTerminalHeight && this.terminal) {
            this.terminal.style.height = savedTerminalHeight + 'px';
            this.terminalResizeHandle.style.bottom = savedTerminalHeight + 'px';
            if (this.contentContainer) {
                this.contentContainer.style.height = `calc(100vh - ${savedTerminalHeight + 80}px)`;
            }
        }
        
        this.init();
    }

    init() {
        this.checkModelStatus();
        this.addEventListeners();
        this.initResizeHandlers();
        this.renderChatList();
        this.initializeTheme();
        this.initializeModel();
        
        if (Object.keys(this.chats).length === 0) {
            this.createNewChat();
        } else {
            const lastChatId = localStorage.getItem('lastActiveChatId');
            if (lastChatId && this.chats[lastChatId]) {
                this.loadChat(lastChatId);
            } else {
                this.loadChat(Object.keys(this.chats)[0]);
            }
        }

        // Restore terminal visibility
        const terminalVisible = localStorage.getItem('terminalVisible') === 'true';
        if (terminalVisible) {
            this.showTerminal();
        }
    }

    initializeTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        this.themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    }

    initializeModel() {
        this.modelSelect.value = this.currentModel;
        // Disable R1 model option for now
        const r1Option = this.modelSelect.querySelector('option[value="deepseek-r1:7b"]');
        if (r1Option) {
            r1Option.disabled = true;
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        this.themeToggleBtn.textContent = isDark ? '🌙' : '☀️';
        localStorage.setItem('darkMode', !isDark);
        
        // Update terminal colors based on theme
        if (this.terminal) {
            this.terminal.style.backgroundColor = `var(--terminal-bg)`;
            this.terminal.style.color = `var(--terminal-text)`;
        }
    }

    addEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.promptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        this.restartServerBtn.addEventListener('click', () => this.restartServer());
        this.toggleTerminalBtn.addEventListener('click', () => this.toggleTerminal());
        this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        this.clearTerminalBtn.addEventListener('click', () => this.clearTerminal());
        this.exportChatsBtn.addEventListener('click', () => this.exportChats());
        this.importChatsBtn.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput.addEventListener('change', (e) => this.importChats(e));
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        this.modelSelect.addEventListener('change', (e) => this.handleModelChange(e));
    }

    handleModelChange(event) {
        const newModel = event.target.value;
        const oldModel = this.currentModel;
        
        this.currentModel = newModel;
        localStorage.setItem('selectedModel', newModel);
        
        // Check if the new model is available
        this.checkModelStatus().then(() => {
            if (this.currentModel !== newModel) {
                // checkModelStatus reverted the model change
                event.target.value = this.currentModel;
            } else {
                this.log(`Switched to ${newModel} model`);
            }
        });
    }

    async checkModelStatus() {
        try {
            const response = await fetch('http://localhost:11434/api/tags', {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // Fix: Keep the full model names including tags
            const availableModels = data.models ? data.models.map(model => model.name) : [];
            
            this.log('Available models: ' + availableModels.join(', '), 'info');
            
            if (availableModels.length === 0) {
                this.updateStatus(false, 'No models found');
                this.log('No models found. Try restarting Ollama server.', 'error');
                return;
            }
            
            // Fix: Check for models including their tags
            const hasDeepseekCoder = availableModels.some(model => 
                model.startsWith('deepseek-coder'));
            const hasDeepseekR1 = availableModels.some(model => 
                model.startsWith('deepseek-r1'));
            
            // Update model select options
            const r1Option = this.modelSelect.querySelector('option[value="deepseek-r1:7b"]');
            if (r1Option) {
                r1Option.disabled = !hasDeepseekR1;
                r1Option.textContent = hasDeepseekR1 ? 'DeepSeek R1 7B' : 'DeepSeek R1 7B (Not Installed)';
            }
            
            const coderOption = this.modelSelect.querySelector('option[value="deepseek-coder"]');
            if (coderOption) {
                coderOption.disabled = !hasDeepseekCoder;
                coderOption.textContent = hasDeepseekCoder ? 'DeepSeek Coder' : 'DeepSeek Coder (Not Installed)';
            }

            // Fix: Check if current model is available (including any tag)
            const isCurrentModelAvailable = availableModels.some(model => 
                model.startsWith(this.currentModel));

            if (!isCurrentModelAvailable) {
                if (hasDeepseekCoder) {
                    this.currentModel = 'deepseek-coder';
                    this.modelSelect.value = 'deepseek-coder';
                    localStorage.setItem('selectedModel', 'deepseek-coder');
                    this.log('Switched to DeepSeek Coder as current model is not available', 'warning');
                } else if (hasDeepseekR1) {
                    this.currentModel = 'deepseek-r1:7b';
                    this.modelSelect.value = 'deepseek-r1:7b';
                    localStorage.setItem('selectedModel', 'deepseek-r1:7b');
                    this.log('Switched to DeepSeek R1 7B as current model is not available', 'warning');
                } else {
                    this.updateStatus(false, 'No models available');
                    this.log('No DeepSeek models found. Please install using: ollama pull deepseek-coder', 'error');
                    return;
                }
            }

            this.updateStatus(true, 'Model ready');
            this.log(`${this.currentModel} is ready`, 'info');
            
        } catch (error) {
            let errorMessage = 'Error connecting to Ollama server';
            if (error.name === 'TimeoutError') {
                errorMessage = 'Connection to Ollama server timed out';
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to Ollama server. Is it running?';
            }
            
            this.updateStatus(false, errorMessage);
            this.log(errorMessage + '. Try restarting the server.', 'error');
            
            // Disable all model options
            this.modelSelect.querySelectorAll('option').forEach(option => {
                option.disabled = true;
            });
        }
    }

    async sendMessage() {
        const prompt = this.promptInput.value.trim();
        if (!prompt) return;

        // Fix: Check if the current model is available before sending
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json();
            const availableModels = data.models.map(model => model.name);
            
            // Fix: Check if any version of the model is available
            const isModelAvailable = availableModels.some(model => 
                model.startsWith(this.currentModel));
            
            if (!isModelAvailable) {
                this.log(`Model ${this.currentModel} is not available. Please install it first using: ollama pull ${this.currentModel}`, 'error');
                return;
            }
        } catch (error) {
            this.log('Error checking model availability: ' + error.message, 'error');
            return;
        }

        this.addMessage(prompt, true);
        this.promptInput.value = '';
        this.sendButton.disabled = true;
        this.log(`Sending prompt to ${this.currentModel}: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    prompt: prompt,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let currentMessage = document.createElement('div');
            currentMessage.className = 'message assistant';
            this.messages.appendChild(currentMessage);
            
            let buffer = '';
            let codeBlockBuffer = '';
            let inCodeBlock = false;
            let responseStartTime = Date.now();

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                        const data = JSON.parse(line);
                        buffer += data.response;

                        // Handle code blocks
                        if (buffer.includes('```')) {
                            const parts = buffer.split(/(```[^`]*```)/g);
                            parts.forEach(part => {
                                if (part.startsWith('```') && part.endsWith('```')) {
                                    const code = part.slice(3, -3);
                                    const pre = document.createElement('pre');
                                    pre.textContent = code;
                                    currentMessage.appendChild(pre);
                                } else if (part.trim()) {
                                    const text = document.createElement('p');
                                    text.textContent = part;
                                    currentMessage.appendChild(text);
                                }
                            });
                        } else {
                            currentMessage.textContent = buffer;
                        }
                        
                        this.messages.scrollTop = this.messages.scrollHeight;
                        
                        // Save message to current chat
                        if (this.currentChatId) {
                            this.chats[this.currentChatId].messages.push({
                                content: buffer,
                                isUser: false,
                                timestamp: Date.now()
                            });
                            this.saveChats();
                        }
                    } catch (e) {
                        this.log('Error parsing response: ' + e.message, 'error');
                    }
                }
            }

            const responseTime = ((Date.now() - responseStartTime) / 1000).toFixed(2);
            this.log(`Response completed in ${responseTime}s`, 'info');

        } catch (error) {
            this.log('Error sending message: ' + error.message, 'error');
            if (error.message.includes('404')) {
                this.addMessage(`Error: Model ${this.currentModel} is not installed. Please install it using: ollama pull ${this.currentModel}`);
            } else {
                this.addMessage('Error: Could not get a response from the model. Please make sure Ollama is running and the selected model is installed.');
            }
        }

        this.sendButton.disabled = false;
    }

    loadChats() {
        const savedChats = localStorage.getItem('ollama-chats');
        return savedChats ? JSON.parse(savedChats) : {};
    }

    saveChats() {
        localStorage.setItem('ollama-chats', JSON.stringify(this.chats));
        localStorage.setItem('lastActiveChatId', this.currentChatId);
    }

    createNewChat() {
        const chatId = Date.now().toString();
        this.chats[chatId] = {
            id: chatId,
            title: 'New Chat',
            messages: []
        };
        this.saveChats();
        this.renderChatList();
        this.loadChat(chatId);
    }

    loadChat(chatId) {
        this.currentChatId = chatId;
        this.messages.innerHTML = '';
        
        // Update active state in sidebar
        const chatItems = this.chatList.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            item.classList.toggle('active', item.dataset.chatId === chatId);
        });
        
        // Load messages
        const chat = this.chats[chatId];
        chat.messages.forEach(msg => {
            this.addMessage(msg.content, msg.isUser);
        });
    }

    clearCurrentChat() {
        if (this.currentChatId) {
            this.chats[this.currentChatId].messages = [];
            this.saveChats();
            this.messages.innerHTML = '';
        }
    }

    updateChatTitle() {
        if (this.currentChatId && this.chats[this.currentChatId].messages.length > 0) {
            const firstMessage = this.chats[this.currentChatId].messages[0].content;
            const title = firstMessage.split('\n')[0].slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
            this.chats[this.currentChatId].title = title;
            this.saveChats();
            this.renderChatList();
        }
    }

    async restartServer() {
        this.updateStatus(false, 'Restarting server...');
        this.restartServerBtn.disabled = true;
        this.log('Attempting to restart server...', 'warning');
        
        try {
            // Try to stop the server gracefully
            await fetch('http://localhost:11434/api/stop', {
                method: 'POST',
                signal: AbortSignal.timeout(5000)
            }).catch(() => {
                this.log('Could not stop server gracefully, might already be stopped', 'warning');
            });
            
            this.log('Server stopped, please start Ollama server manually using "ollama serve"', 'info');
            this.updateStatus(false, 'Server stopped');
            
            // Start checking for server availability
            this.checkServerAvailability();
        } catch (error) {
            let errorMessage = 'Error restarting server';
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout while stopping server';
            }
            this.log(errorMessage + ': ' + error.message, 'error');
            this.updateStatus(false, errorMessage);
        } finally {
            this.restartServerBtn.disabled = false;
        }
    }

    async checkServerAvailability() {
        const maxAttempts = 10;
        let attempts = 0;
        
        const checkAvailability = async () => {
            try {
                const response = await fetch('http://localhost:11434/api/tags');
                if (response.ok) {
                    this.checkModelStatus();
                    this.restartServerBtn.disabled = false;
                    this.log('Server is now available', 'info');
                    return;
                }
            } catch (error) {
                this.log('Server not available yet, retrying...');
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkAvailability, 2000);
            } else {
                this.log('Server restart failed after maximum attempts', 'error');
                this.updateStatus(false, 'Server restart failed');
                this.restartServerBtn.disabled = false;
            }
        };
        
        checkAvailability();
    }

    toggleSidebar() {
        if (!this.appContainer || !this.toggleSidebarBtn) return;
        
        const isVisible = !this.appContainer.classList.contains('sidebar-hidden');
        
        if (isVisible) {
            this.appContainer.classList.add('sidebar-hidden');
            this.toggleSidebarBtn.innerHTML = '☰';
            // Disable resize handle
            if (this.sidebarResizeHandle) {
                this.sidebarResizeHandle.style.pointerEvents = 'none';
                this.sidebarResizeHandle.style.opacity = '0';
            }
        } else {
            this.appContainer.classList.remove('sidebar-hidden');
            this.toggleSidebarBtn.innerHTML = '✕';
            // Enable resize handle
            if (this.sidebarResizeHandle) {
                this.sidebarResizeHandle.style.pointerEvents = 'auto';
                this.sidebarResizeHandle.style.opacity = '1';
            }
            // Restore saved width if exists
            const savedWidth = localStorage.getItem('sidebarWidth');
            if (savedWidth && this.sidebar) {
                this.sidebar.style.width = `${savedWidth}px`;
            }
        }
        
        localStorage.setItem('sidebarVisible', !isVisible);
    }

    initResizeHandlers() {
        if (this.sidebarResizeHandle && this.sidebar) {
            this.sidebarResizeHandle.addEventListener('mousedown', (e) => {
                if (this.appContainer.classList.contains('sidebar-hidden')) {
                    return;
                }
                
                e.preventDefault();
                this.sidebarResizeHandle.classList.add('active');
                document.body.style.cursor = 'col-resize';
                
                const startX = e.clientX;
                const startWidth = this.sidebar.offsetWidth;
                
                const doDrag = (e) => {
                    const newWidth = Math.min(Math.max(200, startWidth + e.clientX - startX), 500);
                    this.sidebar.style.width = `${newWidth}px`;
                    this.mainContent.style.marginLeft = `${newWidth}px`;
                    localStorage.setItem('sidebarWidth', newWidth);
                };
                
                const stopDrag = () => {
                    document.removeEventListener('mousemove', doDrag);
                    document.removeEventListener('mouseup', stopDrag);
                    this.sidebarResizeHandle.classList.remove('active');
                    document.body.style.cursor = '';
                };
                
                document.addEventListener('mousemove', doDrag);
                document.addEventListener('mouseup', stopDrag);
            });
        }
        
        if (this.terminalResizeHandle && this.terminal) {
            this.terminalResizeHandle.addEventListener('mousedown', (e) => {
                if (!this.terminal.classList.contains('visible')) {
                    return;
                }
                
                e.preventDefault();
                this.terminalResizeHandle.classList.add('active');
                document.body.style.cursor = 'row-resize';
                
                const startY = e.clientY;
                const terminalRect = this.terminal.getBoundingClientRect();
                const startHeight = terminalRect.height;
                
                const doDrag = (e) => {
                    const deltaY = startY - e.clientY;
                    const newHeight = Math.min(
                        Math.max(100, startHeight + deltaY),
                        window.innerHeight - 200
                    );
                    
                    this.terminal.style.height = `${newHeight}px`;
                    this.contentContainer.style.height = `calc(100vh - ${newHeight + 80}px)`;
                    localStorage.setItem('terminalHeight', newHeight);
                };
                
                const stopDrag = () => {
                    document.removeEventListener('mousemove', doDrag);
                    document.removeEventListener('mouseup', stopDrag);
                    this.terminalResizeHandle.classList.remove('active');
                    document.body.style.cursor = '';
                };
                
                document.addEventListener('mousemove', doDrag);
                document.addEventListener('mouseup', stopDrag);
            });
        }
    }

    showTerminal() {
        this.terminal.classList.add('visible');
        this.contentContainer.style.height = `calc(100vh - ${this.terminal.offsetHeight + 80}px)`;
        this.toggleTerminalBtn.innerHTML = '🖥️ Hide';
        // Enable resize handle
        if (this.terminalResizeHandle) {
            this.terminalResizeHandle.style.pointerEvents = 'auto';
            this.terminalResizeHandle.style.opacity = '1';
        }
        this.log('Terminal shown');
    }

    hideTerminal() {
        this.terminal.classList.remove('visible');
        this.contentContainer.style.height = 'calc(100vh - 80px)';
        this.toggleTerminalBtn.innerHTML = '🖥️ Show';
        // Disable resize handle
        if (this.terminalResizeHandle) {
            this.terminalResizeHandle.style.pointerEvents = 'none';
            this.terminalResizeHandle.style.opacity = '0';
        }
        this.log('Terminal hidden');
    }

    toggleTerminal() {
        if (!this.terminal || !this.toggleTerminalBtn || !this.contentContainer) return;
        
        const isVisible = this.terminal.classList.contains('visible');
        
        if (isVisible) {
            this.hideTerminal();
        } else {
            this.showTerminal();
        }
        
        localStorage.setItem('terminalVisible', !isVisible);
    }

    clearTerminal() {
        if (!this.terminalContent) return;
        this.terminalContent.innerHTML = '';
        this.log('Terminal cleared');
    }

    log(message, type = 'info') {
        if (!this.terminalContent) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logElement = document.createElement('div');
        logElement.className = `log ${type}`;
        logElement.textContent = `[${timestamp}] ${message}`;
        
        this.terminalContent.appendChild(logElement);
        this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
        
        // Show terminal for important messages
        if (type === 'error' || type === 'warning') {
            this.showTerminal();
        }
    }

    exportChats() {
        const data = {
            version: 1,
            timestamp: Date.now(),
            chats: this.chats
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ollama-chats-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.log('Chats exported successfully');
    }

    async importChats(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.version || !data.chats) {
                throw new Error('Invalid file format');
            }
            
            // Merge imported chats with existing ones
            Object.entries(data.chats).forEach(([id, chat]) => {
                if (!this.chats[id]) {
                    this.chats[id] = chat;
                }
            });
            
            this.saveChats();
            this.renderChatList();
            this.log('Chats imported successfully');
        } catch (error) {
            this.log('Error importing chats: ' + error.message, 'error');
        }
        
        event.target.value = ''; // Reset file input
    }

    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            delete this.chats[chatId];
            this.saveChats();
            
            if (chatId === this.currentChatId) {
                const remainingChats = Object.keys(this.chats);
                if (remainingChats.length > 0) {
                    this.loadChat(remainingChats[0]);
                } else {
                    this.createNewChat();
                }
            } else {
                this.renderChatList();
            }
            
            this.log(`Chat deleted: ${chatId}`);
        }
    }

    renderChatList() {
        this.chatList.innerHTML = '';
        Object.values(this.chats).reverse().forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item' + (chat.id === this.currentChatId ? ' active' : '');
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = chat.title || 'New Chat';
            chatItem.appendChild(titleSpan);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete Chat';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            };
            chatItem.appendChild(deleteBtn);
            
            chatItem.dataset.chatId = chat.id;
            chatItem.addEventListener('click', () => this.loadChat(chat.id));
            this.chatList.appendChild(chatItem);
        });
    }

    updateStatus(connected, message) {
        this.statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
        this.statusText.textContent = message;
        this.sendButton.disabled = !connected;
    }

    addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
        
        if (content.includes('```')) {
            const parts = content.split(/(```[^`]*```)/g);
            parts.forEach(part => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const code = part.slice(3, -3);
                    const pre = document.createElement('pre');
                    pre.textContent = code;
                    messageDiv.appendChild(pre);
                } else if (part.trim()) {
                    const text = document.createElement('p');
                    text.textContent = part;
                    messageDiv.appendChild(text);
                }
            });
        } else {
            messageDiv.textContent = content;
        }
        
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
        
        // Save message to current chat
        if (this.currentChatId) {
            this.chats[this.currentChatId].messages.push({
                content,
                isUser,
                timestamp: Date.now()
            });
            this.saveChats();
            
            // Update chat title if this is the first message
            if (this.chats[this.currentChatId].messages.length === 1) {
                this.updateChatTitle();
            }
        }
    }

}

// Initialize the chat when the page loads
const chat = new OllamaChat();
