class MCPChatClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentApprovalId = null;
        this.currentMessage = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.connect();
    }
    
    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.messages = document.getElementById('messages');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Modal elements
        this.approvalModal = document.getElementById('approvalModal');
        this.toolName = document.getElementById('toolName');
        this.toolArgs = document.getElementById('toolArgs');
        this.approveButton = document.getElementById('approveButton');
        this.denyButton = document.getElementById('denyButton');
    }
    
    setupEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });
        
        // Approval modal buttons
        this.approveButton.addEventListener('click', () => this.handleApproval(true));
        this.denyButton.addEventListener('click', () => this.handleApproval(false));
        
        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.approvalModal.style.display !== 'none') {
                this.handleApproval(false);
            }
        });
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };
    }
    
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        if (connected) {
            this.statusDot.classList.add('connected');
            this.statusText.textContent = 'Connected';
            this.messageInput.disabled = false;
            this.sendButton.disabled = false;
        } else {
            this.statusDot.classList.remove('connected');
            this.statusText.textContent = 'Disconnected';
            this.messageInput.disabled = true;
            this.sendButton.disabled = true;
        }
    }
    
    handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'system_ready':
                this.addSystemMessage(message.message);
                break;
                
            case 'assistant_start':
                console.log('Starting new assistant message');
                // Create assistant message with separate tool and content sections
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message assistant-message';
                // tool container (for executing, blocked, results)
                const toolContainer = document.createElement('div');
                toolContainer.className = 'tool-container';
                msgDiv.appendChild(toolContainer);
                // content container for LLM text
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                msgDiv.appendChild(contentDiv);
                this.messages.appendChild(msgDiv);
                this.scrollToBottom();
                // set current contexts
                this.currentToolContainer = toolContainer;
                this.currentMessage = contentDiv;
                break;
                
            case 'text_delta':
                console.log('Text delta:', message.content);
                if (this.currentMessage) {
                    this.appendToMessage(this.currentMessage, message.content);
                } else {
                    console.warn('Received text_delta but no current message');
                }
                break;
                
            case 'assistant_complete':
                console.log('Assistant message complete');
                this.currentMessage = null;
                this.scrollToBottom();
                break;
                
            case 'approval_request':
                console.log('Approval request received:', message);
                this.showApprovalModal(message);
                break;
                
            case 'tool_executing':
                console.log('Tool executing:', message.tool_name);
                if (this.currentToolContainer) {
                    const div = document.createElement('div');
                    div.className = 'tool-executing-inline';
                    div.textContent = `🔧 Executing tool: ${message.tool_name}`;
                    this.currentToolContainer.appendChild(div);
                    this.scrollToBottom();
                } else {
                    this.addToolMessage(`🔧 Executing tool: ${message.tool_name}`, 'executing');
                }
                break;
                
            case 'tool_blocked':
                console.log('Tool blocked:', message.tool_name);
                if (this.currentToolContainer) {
                    const div = document.createElement('div');
                    div.className = 'tool-blocked-inline';
                    div.textContent = `⛔ Tool blocked: ${message.tool_name}`;
                    this.currentToolContainer.appendChild(div);
                    this.scrollToBottom();
                } else {
                    this.addToolMessage(`⛔ Tool blocked: ${message.tool_name}`, 'blocked');
                }
                break;
                
            case 'tool_result':
                console.log('Tool result received:', message.content);
                if (this.currentToolContainer) {
                    const details = document.createElement('details');
                    details.className = 'tool-result-details';
                    const lines = message.content.split('\n');
                    const summary = document.createElement('summary');
                    summary.textContent = `Tool result: ${lines.length} line${lines.length > 1 ? 's' : ''}`;
                    details.appendChild(summary);
                    const pre = document.createElement('pre');
                    pre.textContent = message.content;
                    details.appendChild(pre);
                    this.currentToolContainer.appendChild(details);
                    this.scrollToBottom();
                } else {
                    this.addToolMessage(`📋 Tool result:\n${message.content}`, 'result');
                }
                break;
                
            case 'tool_result_blocked':
                console.log('Tool result blocked');
                if (this.currentToolContainer) {
                    const div = document.createElement('div');
                    div.className = 'tool-blocked-inline';
                    div.textContent = '⛔ Tool result blocked (tool was not approved)';
                    this.currentToolContainer.appendChild(div);
                    this.scrollToBottom();
                } else {
                    this.addToolMessage('⛔ Tool result blocked (tool was not approved)', 'blocked');
                }
                break;
                
            case 'error':
                console.error('Server error:', message.message);
                this.addSystemMessage(`❌ Error: ${message.message}`, 'error');
                break;
                
            default:
                console.warn('Unknown message type:', message.type, message);
        }
    }
    
    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || !this.isConnected) return;
        
        // Add user message to chat
        this.addMessage('user', content);
        
        // Send to server
        this.ws.send(JSON.stringify({
            type: 'chat_message',
            content: content
        }));
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        this.scrollToBottom();
    }
    
    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        
        this.scrollToBottom();
        return contentDiv;
    }
    
    addSystemMessage(content, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = content;
        
        messageDiv.appendChild(contentDiv);
        this.messages.appendChild(messageDiv);
        
        this.scrollToBottom();
    }
    
    addToolMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `tool-message tool-${type}`;
        messageDiv.textContent = content;
        
        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    appendToMessage(messageElement, content) {
        messageElement.textContent += content;
        this.scrollToBottom();
    }
    
    showApprovalModal(message) {
        this.currentApprovalId = message.approval_id;
        this.toolName.textContent = message.tool_name;
        this.toolArgs.textContent = JSON.stringify(message.args, null, 2);
        this.approvalModal.style.display = 'flex';
    }
    
    handleApproval(approved) {
        if (!this.currentApprovalId) {
            console.error('No current approval ID when handling approval');
            return;
        }
        
        console.log(`Sending approval response: ${this.currentApprovalId} = ${approved}`);
        
        // Send approval response
        this.ws.send(JSON.stringify({
            type: 'approval_response',
            approval_id: this.currentApprovalId,
            approved: approved
        }));
        
        // Hide modal
        this.approvalModal.style.display = 'none';
        this.currentApprovalId = null;
        
        // Re-enable input after approval is sent
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
    }
    
    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }
}

// Initialize the chat client when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MCPChatClient();
});
