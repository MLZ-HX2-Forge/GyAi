/**
 * AI对话组件
 */

const Chat = {
    currentConversationId: null,
    currentModel: 'deepseek',
    messages: [],
    isGenerating: false,
    abortController: null,
    uploadedImages: [],
    sidebarCollapsed: false,

    models: {
        deepseek: { name: 'DeepSeek V3.1', icon: 'DS' },
        kimi: { name: 'Kimi K2', icon: 'KM' },
        doubao_vision: { name: '豆包视觉', icon: 'DB' }
    },

    async init() {
        await Auth.checkSession();
        this.bindEvents();
        this.initAutoResize();
        this.initSidebar();
        await this.loadConversations();
        this.checkMobileView();
    },

    bindEvents() {
        const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
        const collapsedToggleBtn = document.getElementById('collapsedToggleBtn');
        const newChatBtn = document.getElementById('newChatBtn');
        const collapsedNewChatBtn = document.getElementById('collapsedNewChatBtn');
        const collapsedSearchBtn = document.getElementById('collapsedSearchBtn');
        const collapsedUserBtn = document.getElementById('collapsedUserBtn');
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');
        const messageInput = document.getElementById('messageInput');
        const attachmentBtn = document.getElementById('attachmentBtn');
        const attachmentMenu = document.getElementById('attachmentMenu');
        const uploadImageOption = document.getElementById('uploadImageOption');
        const uploadFileOption = document.getElementById('uploadFileOption');
        const imageInput = document.getElementById('imageInput');
        const fileInput = document.getElementById('fileInput');
        const modelSelector = document.getElementById('modelSelector');
        const modelSelectorWrapper = document.getElementById('modelSelectorWrapper');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const searchInput = document.getElementById('searchInput');
        const logoutBtn = document.getElementById('logoutBtn');
        const userMenu = document.getElementById('userMenu');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsBackBtn = document.getElementById('settingsBackBtn');
        const clearLocalDataBtn = document.getElementById('clearLocalDataBtn');

        if (sidebarCollapseBtn) {
            sidebarCollapseBtn.addEventListener('click', () => this.toggleSidebar());
        }

        if (collapsedToggleBtn) {
            collapsedToggleBtn.addEventListener('click', () => this.toggleSidebar());
        }

        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.createNewConversation());
        }

        if (collapsedNewChatBtn) {
            collapsedNewChatBtn.addEventListener('click', () => this.createNewConversation());
        }

        if (collapsedSearchBtn) {
            collapsedSearchBtn.addEventListener('click', () => {
                this.expandSidebar();
                setTimeout(() => {
                    const input = document.getElementById('searchInput');
                    if (input) input.focus();
                }, 300);
            });
        }

        if (collapsedUserBtn) {
            collapsedUserBtn.addEventListener('click', () => {
                if (Auth.isGuest) {
                    Auth.showModal();
                } else {
                    this.expandSidebar();
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchConversations(e.target.value);
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        if (userMenu) {
            userMenu.addEventListener('click', () => {
                if (Auth.isGuest) {
                    Auth.showModal();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopGeneration());
        }

        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            messageInput.addEventListener('input', () => {
                this.autoResize();
                this.updateSendButton();
            });
        }

        if (attachmentBtn && attachmentMenu) {
            attachmentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleAttachmentMenu();
            });

            document.addEventListener('click', (e) => {
                if (!attachmentMenu.contains(e.target) && !attachmentBtn.contains(e.target)) {
                    this.hideAttachmentMenu();
                }
            });
        }

        if (uploadImageOption && imageInput) {
            uploadImageOption.addEventListener('click', () => {
                imageInput.click();
                this.hideAttachmentMenu();
            });
        }

        if (uploadFileOption && fileInput) {
            uploadFileOption.addEventListener('click', () => {
                fileInput.click();
                this.hideAttachmentMenu();
            });
        }

        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        if (modelSelector && modelSelectorWrapper) {
            modelSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                modelSelectorWrapper.classList.toggle('active');
            });

            document.addEventListener('click', () => {
                modelSelectorWrapper.classList.remove('active');
            });

            document.querySelectorAll('.model-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectModel(option.dataset.model);
                    modelSelectorWrapper.classList.remove('active');
                });
            });
        }

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSettings();
            });
        }

        if (settingsBackBtn) {
            settingsBackBtn.addEventListener('click', () => this.hideSettings());
        }

        if (clearLocalDataBtn) {
            clearLocalDataBtn.addEventListener('click', () => this.clearLocalData());
        }

        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const question = chip.dataset.question;
                if (question) {
                    const input = document.getElementById('messageInput');
                    if (input) {
                        input.value = question;
                        this.autoResize();
                        this.updateSendButton();
                        this.sendMessage();
                    }
                }
            });
        });

        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');

            if (Utils.isMobile() && sidebar && !sidebar.contains(e.target) &&
                mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
                if (!sidebar.classList.contains('collapsed')) {
                    this.collapseSidebar();
                }
            }
        });
    },

    initSidebar() {
        const savedState = Utils.storage.get('sidebarCollapsed');
        if (savedState !== null) {
            this.sidebarCollapsed = savedState;
            const sidebar = document.getElementById('sidebar');
            const collapsedIcons = document.getElementById('collapsedIcons');
            if (sidebar) {
                if (this.sidebarCollapsed) {
                    sidebar.classList.add('collapsed');
                    if (collapsedIcons) collapsedIcons.classList.add('active');
                } else {
                    sidebar.classList.remove('collapsed');
                    if (collapsedIcons) collapsedIcons.classList.remove('active');
                }
            }
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const collapsedIcons = document.getElementById('collapsedIcons');
        if (!sidebar) return;

        this.sidebarCollapsed = !this.sidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
        
        if (collapsedIcons) {
            collapsedIcons.classList.toggle('active', this.sidebarCollapsed);
        }

        Utils.storage.set('sidebarCollapsed', this.sidebarCollapsed);
    },

    expandSidebar() {
        if (this.sidebarCollapsed) {
            this.toggleSidebar();
        }
    },

    collapseSidebar() {
        if (!this.sidebarCollapsed) {
            this.toggleSidebar();
        }
    },

    handleLogout() {
        Auth.logout();
    },

    initAutoResize() {
        const textarea = document.getElementById('messageInput');
        if (textarea) {
            textarea.style.resize = 'none';
            textarea.style.overflow = 'hidden';
        }
    },

    autoResize() {
        const textarea = document.getElementById('messageInput');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
    },

    updateSendButton() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (input && sendBtn) {
            const hasContent = input.value.trim() || this.uploadedImages.length > 0;
            sendBtn.disabled = !hasContent || this.isGenerating;
        }
    },

    selectModel(model) {
        this.currentModel = model;

        const modelNameEl = document.getElementById('currentModelName');
        if (modelNameEl && this.models[model]) {
            modelNameEl.textContent = this.models[model].name;
        }

        document.querySelectorAll('.model-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.model === model);
        });

        if (this.currentConversationId) {
            API.conversations.update(this.currentConversationId, { model });
        }
    },

    async handleImageUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            try {
                const base64 = await this.fileToBase64(file);
                this.uploadedImages.push({
                    id: Utils.generateId(),
                    data: base64,
                    name: file.name
                });
            } catch (error) {
                console.error('图片上传失败:', error);
            }
        }

        this.renderUploadedImages();
        this.updateSendButton();

        if (this.uploadedImages.length > 0 && this.currentModel !== 'doubao_vision') {
            this.selectModel('doubao_vision');
        }

        e.target.value = '';
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    renderUploadedImages() {
        const container = document.getElementById('uploadedImages');
        if (!container) return;

        container.innerHTML = this.uploadedImages.map(img => `
            <div class="uploaded-image" data-id="${img.id}">
                <img src="${img.data}" alt="${img.name}">
                <button class="uploaded-image-remove" onclick="Chat.removeImage('${img.id}')">×</button>
            </div>
        `).join('');
    },

    removeImage(id) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id !== id);
        this.renderUploadedImages();
        this.updateSendButton();
    },

    async loadConversations() {
        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.list();
                if (result.code === 200 && result.data) {
                    this.allConversations = result.data;
                    this.renderConversations(result.data);
                }
            } catch (error) {
                console.error('加载对话列表失败:', error);
            }
        } else {
            const localConversations = Utils.storage.get('guest_conversations') || [];
            this.allConversations = localConversations;
            this.renderConversations(localConversations);
        }
    },

    searchConversations(query) {
        if (!this.allConversations) return;

        const filtered = this.allConversations.filter(conv =>
            conv.title.toLowerCase().includes(query.toLowerCase())
        );
        this.renderConversations(filtered);
    },

    renderConversations(conversations) {
        const container = document.getElementById('conversationList');
        if (!container) return;

        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-muted);">
                    暂无对话记录
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}"
                 data-id="${conv.id}" onclick="Chat.selectConversation('${conv.id}')">
                <div class="conversation-icon">💬</div>
                <div class="conversation-info">
                    <div class="conversation-title">${Utils.escapeHtml(conv.title)}</div>
                    <div class="conversation-time">${TimeUtils.relative(conv.updated_at)}</div>
                </div>
                <div class="conversation-actions">
                    <button class="conversation-action" onclick="event.stopPropagation(); Chat.showDeleteDialog('${conv.id}')" title="删除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async showDeleteDialog(id) {
        const confirmed = await ConfirmDialog.show({
            title: '删除对话',
            message: '确定要删除这个对话吗？',
            confirmText: '删除',
            cancelText: '取消',
            type: 'danger',
            showWarning: true,
            warningText: '删除后将无法恢复'
        });

        if (confirmed) {
            await this.deleteConversation(id);
        }
    },

    async selectConversation(id) {
        this.currentConversationId = id;

        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });

        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.get(id);
                if (result.code === 200 && result.data) {
                    this.messages = result.data.messages || [];
                    this.currentModel = result.data.model || 'deepseek';
                    this.selectModel(this.currentModel);

                    const titleEl = document.getElementById('chatTitle');
                    if (titleEl) {
                        titleEl.textContent = result.data.title || '对话';
                    }

                    this.renderMessages();

                    if (Utils.isMobile()) {
                        this.collapseSidebar();
                    }
                }
            } catch (error) {
                console.error('加载对话失败:', error);
            }
        } else {
            const conversations = Utils.storage.get('guest_conversations') || [];
            const conversation = conversations.find(c => c.id === id);
            if (conversation) {
                this.messages = conversation.messages || [];
                this.currentModel = conversation.model || 'deepseek';
                this.selectModel(this.currentModel);

                const titleEl = document.getElementById('chatTitle');
                if (titleEl) {
                    titleEl.textContent = conversation.title || '对话';
                }

                this.renderMessages();

                if (Utils.isMobile()) {
                    this.collapseSidebar();
                }
            }
        }
    },

    async createNewConversation() {
        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.create();
                if (result.code === 200 && result.data) {
                    this.currentConversationId = result.data.id;
                    this.messages = [];

                    const titleEl = document.getElementById('chatTitle');
                    if (titleEl) {
                        titleEl.textContent = '新对话';
                    }

                    this.renderMessages();
                    this.loadConversations();

                    if (Utils.isMobile()) {
                        this.collapseSidebar();
                    }
                }
            } catch (error) {
                console.error('创建对话失败:', error);
            }
        } else {
            const newId = Utils.generateId();
            this.currentConversationId = newId;
            this.messages = [];

            const titleEl = document.getElementById('chatTitle');
            if (titleEl) {
                titleEl.textContent = '新对话';
            }

            this.renderMessages();
            this.saveGuestConversation(newId, '新对话');
            this.loadConversations();

            if (Utils.isMobile()) {
                this.collapseSidebar();
            }
        }
    },

    saveGuestConversation(id, title) {
        const conversations = Utils.storage.get('guest_conversations') || [];
        const existingIndex = conversations.findIndex(c => c.id === id);
        const conversation = {
            id: id,
            title: title,
            model: this.currentModel,
            messages: this.messages,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            conversations[existingIndex] = conversation;
        } else {
            conversations.unshift(conversation);
        }
        
        Utils.storage.set('guest_conversations', conversations);
    },

    async deleteConversation(id) {
        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.delete(id);
                if (result.code === 200) {
                    if (this.currentConversationId === id) {
                        this.currentConversationId = null;
                        this.messages = [];
                        this.renderMessages();
                    }
                    this.loadConversations();
                }
            } catch (error) {
                console.error('删除对话失败:', error);
            }
        } else {
            const conversations = Utils.storage.get('guest_conversations') || [];
            const filtered = conversations.filter(c => c.id !== id);
            Utils.storage.set('guest_conversations', filtered);
            
            if (this.currentConversationId === id) {
                this.currentConversationId = null;
                this.messages = [];
                this.renderMessages();
            }
            this.loadConversations();
        }
    },

    renderMessages() {
        const container = document.getElementById('messagesContainer');
        const emptyState = document.getElementById('emptyState');

        if (!container) return;

        if (this.messages.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'flex';
            }
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        if (emptyState) {
            emptyState.style.display = 'none';
        }

        container.innerHTML = this.messages.map(msg => this.createMessageHTML(msg)).join('');
        this.scrollToBottom();
    },

    createMessageHTML(msg) {
        const isUser = msg.role === 'user';
        const time = TimeUtils.relative(msg.created_at);
        const content = Utils.formatMarkdown(msg.content);

        let imagesHTML = '';
        if (msg.images && msg.images.length > 0) {
            imagesHTML = `
                <div class="message-images">
                    ${msg.images.map(img => `<img src="${img}" class="message-image" alt="上传图片">`).join('')}
                </div>
            `;
        }

        return `
            <div class="message ${msg.role}">
                <div class="message-avatar">${isUser ? 'U' : '🤖'}</div>
                <div class="message-content">
                    ${imagesHTML}
                    <div class="message-bubble">${content}</div>
                    <div class="message-time">${time}</div>
                    ${!isUser ? `
                        <div class="message-actions">
                            <button class="message-action" onclick="Chat.copyMessage('${Utils.escapeHtml(msg.content)}')" title="复制">📋</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input?.value.trim();

        if (!message && this.uploadedImages.length === 0) return;
        if (this.isGenerating) return;

        if (!this.currentConversationId) {
            await this.createNewConversation();
        }

        const userMessage = {
            id: Utils.generateId(),
            role: 'user',
            content: message,
            images: this.uploadedImages.map(img => img.data),
            created_at: new Date().toISOString()
        };

        this.messages.push(userMessage);
        this.renderMessages();

        input.value = '';
        this.autoResize();
        this.uploadedImages = [];
        this.renderUploadedImages();
        this.updateSendButton();

        await this.generateResponse(message, userMessage.images);
    },

    async generateResponse(message, images) {
        this.isGenerating = true;
        this.updateUI();

        const assistantMessage = {
            id: Utils.generateId(),
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString()
        };

        this.messages.push(assistantMessage);
        this.appendTypingIndicator();

        try {
            const history = this.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await API.chat.stream(message, {
                model: this.currentModel,
                history: history,
                images: images,
                conversationId: this.currentConversationId
            });

            this.removeTypingIndicator();

            await SSEClient.processStream(response, {
                onContent: (content) => {
                    assistantMessage.content += content;
                    this.updateLastMessage(assistantMessage.content);
                },
                onError: (error) => {
                    assistantMessage.content = `错误: ${error}`;
                    this.updateLastMessage(assistantMessage.content);
                },
                onDone: () => {
                    this.isGenerating = false;
                    this.updateUI();
                    
                    if (Auth.isGuest) {
                        const title = this.generateConversationTitle(this.messages);
                        this.saveGuestConversation(this.currentConversationId, title);
                    }
                    
                    this.loadConversations();
                }
            });

        } catch (error) {
            console.error('生成响应失败:', error);
            this.removeTypingIndicator();
            assistantMessage.content = '抱歉，发生了错误，请稍后重试。';
            this.updateLastMessage(assistantMessage.content);
            this.isGenerating = false;
            this.updateUI();
        }
    },

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isGenerating = false;
        this.updateUI();
    },

    appendTypingIndicator() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'message assistant';
        indicator.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        container.appendChild(indicator);
        this.scrollToBottom();
    },

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    },

    updateLastMessage(content) {
        const messages = document.querySelectorAll('.message.assistant');
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
            const bubble = lastMessage.querySelector('.message-bubble');
            if (bubble) {
                bubble.innerHTML = Utils.formatMarkdown(content);
            }
        }

        this.scrollToBottom();
    },

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },

    updateUI() {
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (sendBtn) {
            sendBtn.classList.toggle('hidden', this.isGenerating);
        }

        if (stopBtn) {
            stopBtn.classList.toggle('hidden', !this.isGenerating);
        }

        this.updateSendButton();
    },

    async clearChat() {
        const confirmed = await ConfirmDialog.show({
            title: '清空对话',
            message: '确定要清空当前对话吗？',
            confirmText: '确定',
            cancelText: '取消',
            type: 'warning',
            showWarning: true,
            warningText: '清空后将无法恢复'
        });

        if (!confirmed) return;

        this.messages = [];
        this.renderMessages();

        if (this.currentConversationId) {
            await this.deleteConversation(this.currentConversationId);
            this.currentConversationId = null;
        }

        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = '新对话';
        }
    },

    exportChat() {
        if (this.messages.length === 0) {
            this.showToast('暂无对话内容可导出', 'warning');
            return;
        }

        const content = this.messages.map(msg => {
            const role = msg.role === 'user' ? '用户' : '助手';
            return `[${role}]\n${msg.content}`;
        }).join('\n\n---\n\n');

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `对话导出_${TimeUtils.format(new Date(), 'YYYY-MM-DD_HH-mm')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('uploadStatusContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `upload-status ${type === 'error' ? 'error' : 'success'}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    copyMessage(content) {
        Utils.copyToClipboard(content).then(() => {
            this.showToast('已复制到剪贴板', 'success');
        }).catch(() => {
            this.showToast('复制失败', 'error');
        });
    },

    generateConversationTitle(messages) {
        if (messages.length === 0) return '新对话';
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg && firstUserMsg.content) {
            const title = firstUserMsg.content.substring(0, 20);
            return title.length < firstUserMsg.content.length ? title + '...' : title;
        }
        return '新对话';
    },

    handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                this.handleImageFile(file);
            } else {
                this.handleDocumentFile(file);
            }
        }

        e.target.value = '';
    },

    async handleImageFile(file) {
        try {
            const base64 = await this.fileToBase64(file);
            this.uploadedImages.push({
                id: Utils.generateId(),
                data: base64,
                name: file.name,
                type: 'image'
            });
        } catch (error) {
            console.error('图片上传失败:', error);
        }

        this.renderUploadedImages();
        this.updateSendButton();

        if (this.uploadedImages.length > 0 && this.currentModel !== 'doubao_vision') {
            this.selectModel('doubao_vision');
        }
    },

    async handleDocumentFile(file) {
        try {
            const base64 = await this.fileToBase64(file);
            this.uploadedFiles = this.uploadedFiles || [];
            this.uploadedFiles.push({
                id: Utils.generateId(),
                data: base64,
                name: file.name,
                type: 'document',
                mimeType: file.type
            });
            this.showToast(`${file.name} 上传成功`, 'success');
        } catch (error) {
            console.error('文件上传失败:', error);
            this.showToast(`${file.name} 上传失败`, 'error');
        }
    },

    toggleAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        if (menu) {
            menu.classList.toggle('active');
        }
    },

    hideAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        if (menu) {
            menu.classList.remove('active');
        }
    },

    showSettings() {
        if (Auth.isModalOpen) return;
        
        const chatView = document.getElementById('chatView');
        const settingsView = document.getElementById('settingsView');
        
        if (chatView) {
            chatView.classList.add('hidden');
        }
        if (settingsView) {
            settingsView.classList.add('active');
        }
    },

    hideSettings() {
        const chatView = document.getElementById('chatView');
        const settingsView = document.getElementById('settingsView');
        
        if (settingsView) {
            settingsView.classList.remove('active');
        }
        if (chatView) {
            chatView.classList.remove('hidden');
        }
    },

    async clearLocalData() {
        const confirmed = await ConfirmDialog.show({
            title: '清空本地数据',
            message: '确定要清空所有本地存储的对话记录吗？',
            confirmText: '清空',
            cancelText: '取消',
            type: 'danger',
            showWarning: true,
            warningText: '清空后将无法恢复'
        });

        if (confirmed) {
            Utils.storage.remove('guest_conversations');
            this.messages = [];
            this.currentConversationId = null;
            this.renderMessages();
            this.loadConversations();
            this.showToast('本地数据已清空', 'success');
        }
    },

    checkMobileView() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');

        if (Utils.isMobile()) {
            if (mobileMenuBtn) {
                mobileMenuBtn.style.display = 'flex';
            }
            if (sidebar) {
                sidebar.classList.add('collapsed');
                this.sidebarCollapsed = true;
            }
        }

        window.addEventListener('resize', Utils.debounce(() => {
            if (Utils.isMobile()) {
                if (mobileMenuBtn) {
                    mobileMenuBtn.style.display = 'flex';
                }
            } else {
                if (mobileMenuBtn) {
                    mobileMenuBtn.style.display = 'none';
                }
            }
        }, 200));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Chat.init();
});
