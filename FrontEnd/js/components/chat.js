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
    userScrolledUp: false,
    lastScrollTop: 0,
    allConversations: [],
    isCreatingNew: false,

    models: {
        deepseek: { name: 'DeepSeek V3.1', icon: 'DS' },
        kimi: { name: 'Kimi K2', icon: 'KM' },
        doubao_vision: { name: '豆包视觉', icon: 'DB' }
    },

    virtualScroll: {
        enabled: true,
        itemHeight: 150,
        bufferSize: 5,
        visibleStart: 0,
        visibleEnd: 20,
        containerHeight: 0
    },

    performanceOpt: {
        scrollRAF: null,
        lastScrollTop: 0,
        scrollThrottle: 16,
        domCache: new Map(),
        observerInstance: null
    },

    clearHistory: {
        backup: null,
        timer: null,
        countdown: 30
    },

    storageSettings: {
        saveHistory: true,
        duration: 30
    },

    async init() {
        this.loadStorageSettings();
        this.bindEvents();
        this.initAutoResize();
        this.initSidebar();
        this.initPerformanceOptimizations();
        await this.loadConversations();
        this.checkMobileView();
    },

    loadStorageSettings() {
        const saved = Utils.storage.get('storage_settings');
        if (saved) {
            this.storageSettings = { ...this.storageSettings, ...saved };
        }
        this.applyStorageSettings();
    },

    applyStorageSettings() {
        const saveHistoryToggle = document.getElementById('saveHistoryToggle');
        const storageDurationSelect = document.getElementById('storageDurationSelect');
        const storageDurationItem = document.getElementById('storageDurationItem');

        if (saveHistoryToggle) {
            saveHistoryToggle.checked = this.storageSettings.saveHistory;
        }
        if (storageDurationSelect) {
            storageDurationSelect.value = String(this.storageSettings.duration);
        }
        if (storageDurationItem) {
            storageDurationItem.classList.toggle('disabled', !this.storageSettings.saveHistory);
        }
    },

    saveStorageSettings() {
        Utils.storage.set('storage_settings', this.storageSettings);
    },

    initPerformanceOptimizations() {
        this.initEventDelegation();
        this.initIntersectionObserver();
        this.initImageLazyLoad();
    },

    initEventDelegation() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.addEventListener('click', (e) => {
            const target = e.target;
            
            const editBtn = target.closest('.edit-btn');
            if (editBtn) {
                const messageEl = editBtn.closest('.message');
                if (messageEl) {
                    const messageId = messageEl.dataset.messageId;
                    this.editMessage(messageId);
                }
                return;
            }

            const copyBtn = target.closest('.copy-btn');
            if (copyBtn) {
                const messageEl = copyBtn.closest('.message');
                if (messageEl) {
                    const bubble = messageEl.querySelector('.message-bubble');
                    if (bubble) {
                        this.copyMessage(bubble.textContent);
                    }
                }
                return;
            }

            const regenerateBtn = target.closest('.regenerate-btn');
            if (regenerateBtn) {
                this.regenerateResponse();
                return;
            }

            const continueBtn = target.closest('.continue-btn');
            if (continueBtn) {
                this.continueResponse();
                return;
            }
        });

        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            let scrollRAF = null;
            const handleScroll = () => {
                if (scrollRAF) return;
                scrollRAF = requestAnimationFrame(() => {
                    this.handleOptimizedScroll();
                    scrollRAF = null;
                });
            };

            chatMessages.addEventListener('scroll', handleScroll, { passive: true });
        }
    },

    handleOptimizedScroll() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const scrollTop = container.scrollTop;
        const scrollDirection = scrollTop - this.lastScrollTop;
        const isNearBottom = container.scrollHeight - scrollTop - container.clientHeight < 100;

        if (scrollDirection < 0 && !isNearBottom) {
            this.userScrolledUp = true;
        } else if (isNearBottom) {
            this.userScrolledUp = false;
        }

        this.lastScrollTop = scrollTop;
        this.updateScrollButtonVisibility();
    },

    initIntersectionObserver() {
        if (this.performanceOpt.observerInstance) {
            this.performanceOpt.observerInstance.disconnect();
        }

        this.performanceOpt.observerInstance = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        const images = entry.target.querySelectorAll('img[data-src]');
                        images.forEach(img => {
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.removeAttribute('data-src');
                            }
                        });
                    }
                });
            },
            { rootMargin: '100px', threshold: 0.1 }
        );
    },

    initImageLazyLoad() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (this.performanceOpt.observerInstance) {
                this.performanceOpt.observerInstance.observe(img);
            }
        });
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
        const backHomeBtn = document.getElementById('backHomeBtn');
        const monitorBtn = document.getElementById('monitorBtn');

        if (sidebarCollapseBtn) {
            sidebarCollapseBtn.addEventListener('click', () => this.toggleSidebar());
        }

        if (collapsedToggleBtn) {
            collapsedToggleBtn.addEventListener('click', () => this.toggleSidebar());
        }

        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.createNewConversation());
        }

        // Ctrl+J 快捷键新建对话
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                this.createNewConversation();
            }
        });

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

        if (monitorBtn) {
            monitorBtn.addEventListener('click', () => this.toggleMonitor());
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

        // 头像点击事件
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                if (Auth.isGuest) {
                    // 未登录状态：弹出登录模态框
                    Auth.showModal();
                } else {
                    // 已登录状态：弹出下拉菜单
                    const userDropdown = document.getElementById('userDropdown');
                    if (userDropdown) {
                        userDropdown.classList.toggle('show');
                    }
                }
            });
        }

        // 三点图标点击事件
        const userMenuBtn = document.getElementById('userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userDropdown = document.getElementById('userDropdown');
                if (userDropdown) {
                    userDropdown.classList.toggle('show');
                }
            });
        }

        const userDropdown = document.getElementById('userDropdown');
        const dropdownSettings = document.getElementById('dropdownSettings');
        const dropdownLogin = document.getElementById('dropdownLogin');

        if (userDropdown) {
            document.addEventListener('click', (e) => {
                if (!userMenuBtn.contains(e.target) && !userAvatar.contains(e.target)) {
                    userDropdown.classList.remove('show');
                }
            });
        }

        if (dropdownSettings) {
            dropdownSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSettings();
                userDropdown.classList.remove('show');
            });
        }

        if (dropdownLogin) {
            dropdownLogin.addEventListener('click', (e) => {
                e.stopPropagation();
                if (Auth.isGuest) {
                    // 未登录状态：弹出登录模态框
                    Auth.showModal();
                } else {
                    // 已登录状态：退出登录
                    this.handleLogout();
                }
                userDropdown.classList.remove('show');
            });
        }

        if (backHomeBtn) {
            backHomeBtn.addEventListener('click', () => this.goBackHome());
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

        const saveHistoryToggle = document.getElementById('saveHistoryToggle');
        const storageDurationSelect = document.getElementById('storageDurationSelect');
        const cleanExpiredBtn = document.getElementById('cleanExpiredBtn');

        if (saveHistoryToggle) {
            saveHistoryToggle.addEventListener('change', (e) => {
                this.storageSettings.saveHistory = e.target.checked;
                this.saveStorageSettings();
                this.applyStorageSettings();
                
                if (!e.target.checked) {
                    this.showToast('历史消息保存已关闭', 'info');
                } else {
                    this.showToast('历史消息保存已开启', 'success');
                }
            });
        }

        if (storageDurationSelect) {
            storageDurationSelect.addEventListener('change', (e) => {
                this.storageSettings.duration = parseInt(e.target.value);
                this.saveStorageSettings();
                this.showToast(`存储时长已设置为 ${this.getDurationText(this.storageSettings.duration)}`, 'success');
            });
        }

        if (cleanExpiredBtn) {
            cleanExpiredBtn.addEventListener('click', () => this.cleanExpiredMessages());
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

            if (!e.target.closest('.conversation-menu-wrapper')) {
                this.closeAllDropdowns();
            }
        });

        this.initScrollListener();
    },

    initScrollListener() {
        const container = document.getElementById('chatMessages');
        const scrollBtn = document.getElementById('scrollToBottomBtn');
        if (!container) return;

        let scrollTimeout = null;

        const updateScrollButton = () => {
            if (!scrollBtn) return;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            scrollBtn.classList.toggle('visible', !isNearBottom && this.messages.length > 0);
        };

        container.addEventListener('scroll', () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            scrollTimeout = setTimeout(() => {
                const currentScrollTop = container.scrollTop;
                const scrollDirection = currentScrollTop - this.lastScrollTop;

                const isNearBottom = container.scrollHeight - currentScrollTop - container.clientHeight < 100;

                if (scrollDirection < 0 && !isNearBottom) {
                    this.userScrolledUp = true;
                } else if (isNearBottom) {
                    this.userScrolledUp = false;
                }

                this.lastScrollTop = currentScrollTop;
                updateScrollButton();
            }, 50);
        }, { passive: true });

        container.addEventListener('wheel', (e) => {
            const currentScrollTop = container.scrollTop;
            const scrollDirection = currentScrollTop - this.lastScrollTop;
            const isNearBottom = container.scrollHeight - currentScrollTop - container.clientHeight < 100;

            if (scrollDirection < 0 && !isNearBottom) {
                this.userScrolledUp = true;
            } else if (isNearBottom) {
                this.userScrolledUp = false;
            }

            this.lastScrollTop = currentScrollTop;
            updateScrollButton();
        }, { passive: true });

        container.addEventListener('touchstart', () => {
            this.lastScrollTop = container.scrollTop;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            const currentScrollTop = container.scrollTop;
            const scrollDirection = currentScrollTop - this.lastScrollTop;
            const isNearBottom = container.scrollHeight - currentScrollTop - container.clientHeight < 100;

            if (scrollDirection < 0 && !isNearBottom) {
                this.userScrolledUp = true;
            } else if (isNearBottom) {
                this.userScrolledUp = false;
            }

            this.lastScrollTop = currentScrollTop;
            updateScrollButton();
        }, { passive: true });

        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                this.scrollToEnd();
            });
        }

        updateScrollButton();
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
        const dropdownLogin = document.getElementById('dropdownLogin');
        const userMenuBtn = document.getElementById('userMenuBtn');
        
        if (dropdownLogin) {
            dropdownLogin.classList.add('loading');
        }
        
        if (userMenuBtn) {
            userMenuBtn.classList.add('loading');
        }
        
        setTimeout(() => {
            Auth.logout();
            
            if (dropdownLogin) {
                dropdownLogin.classList.remove('loading');
            }
            
            if (userMenuBtn) {
                userMenuBtn.classList.remove('loading');
            }
        }, 300);
    },

    goBackHome() {
        const backHomeBtn = document.getElementById('backHomeBtn');

        if (!backHomeBtn) {
            window.location.href = '/';
            return;
        }

        if (backHomeBtn.classList.contains('loading')) {
            return;
        }

        if (this.isGenerating) {
            const confirmLeave = confirm('正在生成回复，确定要返回主界面吗？');
            if (!confirmLeave) {
                return;
            }
            this.stopGeneration();
        }

        backHomeBtn.classList.add('loading');
        
        this.cleanupBeforeNavigate();

        const transitionOverlay = document.createElement('div');
        transitionOverlay.className = 'page-transition-overlay';
        transitionOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary);
            opacity: 0;
            z-index: 9999;
            pointer-events: none;
            transition: opacity 0.2s ease-out;
        `;
        document.body.appendChild(transitionOverlay);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                transitionOverlay.style.opacity = '1';
            });
        });

        setTimeout(() => {
            window.location.href = '/';
        }, 200);
    },

    cleanupBeforeNavigate() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isGenerating = false;
        
        if (this.performanceOpt.observerInstance) {
            this.performanceOpt.observerInstance.disconnect();
            this.performanceOpt.observerInstance = null;
        }
        
        if (this.performanceOpt.scrollRAF) {
            cancelAnimationFrame(this.performanceOpt.scrollRAF);
            this.performanceOpt.scrollRAF = null;
        }
        
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
            this.scrollAnimationFrame = null;
        }
        
        if (this.clearHistory.timer) {
            clearTimeout(this.clearHistory.timer);
            this.clearHistory.timer = null;
        }
        
        if (this.fpsInterval) {
            clearInterval(this.fpsInterval);
            this.fpsInterval = null;
        }
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
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
                    this.allConversations = this.sortConversations(result.data);
                    this.renderConversations(this.allConversations);
                }
            } catch (error) {
                console.error('加载对话列表失败:', error);
            }
        } else {
            const localConversations = Utils.storage.get('guest_conversations') || [];
            const sortedConversations = this.sortConversations(localConversations);
            this.allConversations = sortedConversations;
            this.renderConversations(sortedConversations);
        }
    },

    sortConversations(conversations) {
        return [...conversations].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updated_at) - new Date(a.updated_at);
        });
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
            <div class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}"
                 data-id="${conv.id}" onclick="Chat.selectConversation('${conv.id}')">
                <div class="conversation-icon">💬</div>
                <div class="conversation-info">
                    <div class="conversation-title">${Utils.escapeHtml(conv.title)}</div>
                    <div class="conversation-time">${TimeUtils.relative(conv.updated_at)}</div>
                </div>
                <div class="conversation-menu-wrapper">
                    <button class="conversation-menu-btn" onclick="event.stopPropagation(); Chat.toggleConversationMenu('${conv.id}')" title="更多操作">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                        </svg>
                    </button>
                    <div class="conversation-dropdown" id="dropdown-${conv.id}">
                        <div class="dropdown-item" onclick="event.stopPropagation(); Chat.renameConversation('${conv.id}', '${Utils.escapeHtml(conv.title).replace(/'/g, "\\'")}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            <span>重命名</span>
                        </div>
                        <div class="dropdown-item" onclick="event.stopPropagation(); Chat.pinConversation('${conv.id}', ${!conv.pinned})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L12 22"/>
                                <path d="M17 7L12 2L7 7"/>
                                <path d="M19 12H5"/>
                            </svg>
                            <span>${conv.pinned ? '取消置顶' : '置顶'}</span>
                        </div>
                        <div class="dropdown-item" onclick="event.stopPropagation(); Chat.shareConversation('${conv.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"/>
                                <circle cx="6" cy="12" r="3"/>
                                <circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            <span>分享</span>
                        </div>
                        <div class="dropdown-item danger" onclick="event.stopPropagation(); Chat.showDeleteDialog('${conv.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            <span>删除</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    toggleConversationMenu(id) {
        const allDropdowns = document.querySelectorAll('.conversation-dropdown');
        const allWrappers = document.querySelectorAll('.conversation-menu-wrapper');
        const currentDropdown = document.getElementById(`dropdown-${id}`);
        const currentItem = document.querySelector(`.conversation-item[data-id="${id}"]`);
        const currentWrapper = currentItem ? currentItem.querySelector('.conversation-menu-wrapper') : null;
        
        const isCurrentlyOpen = currentDropdown && currentDropdown.classList.contains('show');
        
        allDropdowns.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        allWrappers.forEach(wrapper => {
            wrapper.classList.remove('active');
        });
        
        if (currentDropdown && !isCurrentlyOpen) {
            currentDropdown.classList.add('show');
            if (currentWrapper) {
                currentWrapper.classList.add('active');
            }
        }
    },

    closeAllDropdowns() {
        document.querySelectorAll('.conversation-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.conversation-menu-wrapper').forEach(wrapper => {
            wrapper.classList.remove('active');
        });
    },

    async renameConversation(id, currentTitle) {
        this.closeAllDropdowns();
        
        const item = document.querySelector(`.conversation-item[data-id="${id}"]`);
        if (!item) return;

        const titleEl = item.querySelector('.conversation-title');
        if (!titleEl) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.value = currentTitle;
        
        const originalTitle = titleEl.textContent;
        titleEl.innerHTML = '';
        titleEl.appendChild(input);
        input.focus();
        input.select();

        const saveRename = async () => {
            const newTitle = input.value.trim() || originalTitle;
            titleEl.textContent = newTitle;
            
            if (Auth.isLoggedIn() && !Auth.isGuest) {
                try {
                    await API.conversations.update(id, { title: newTitle });
                    const convIndex = this.allConversations.findIndex(c => c.id === id);
                    if (convIndex >= 0) {
                        this.allConversations[convIndex].title = newTitle;
                        this.allConversations[convIndex].updated_at = new Date().toISOString();
                        this.renderConversations(this.allConversations);
                    }
                } catch (error) {
                    console.error('重命名对话失败:', error);
                    this.showToast('重命名失败', 'error');
                    titleEl.textContent = originalTitle;
                    return;
                }
            } else {
                const conversations = Utils.storage.get('guest_conversations') || [];
                const convIndex = conversations.findIndex(c => c.id === id);
                if (convIndex >= 0) {
                    conversations[convIndex].title = newTitle;
                    conversations[convIndex].updated_at = new Date().toISOString();
                    Utils.storage.set('guest_conversations', conversations);
                }
            }

            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle && this.currentConversationId === id) {
                chatTitle.textContent = newTitle;
            }

            this.showToast('对话已重命名', 'success');
        };

        const cancelRename = () => {
            titleEl.textContent = originalTitle;
        };

        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
                input.blur();
            }
        });
    },

    async pinConversation(id, pinned) {
        this.closeAllDropdowns();
        
        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.update(id, { pinned });
                if (result.code === 200) {
                    const convIndex = this.allConversations.findIndex(c => c.id === id);
                    if (convIndex >= 0) {
                        this.allConversations[convIndex].pinned = pinned;
                        this.allConversations[convIndex].updated_at = new Date().toISOString();
                        this.allConversations = this.sortConversations(this.allConversations);
                        this.renderConversations(this.allConversations);
                    }
                    this.showToast(pinned ? '对话已置顶' : '已取消置顶', 'success');
                }
            } catch (error) {
                console.error('置顶对话失败:', error);
                this.showToast('操作失败，请重试', 'error');
            }
        } else {
            const conversations = Utils.storage.get('guest_conversations') || [];
            const convIndex = conversations.findIndex(c => c.id === id);
            
            if (convIndex >= 0) {
                conversations[convIndex].pinned = pinned;
                conversations[convIndex].updated_at = new Date().toISOString();
                Utils.storage.set('guest_conversations', conversations);
                
                this.loadConversations();
                this.showToast(pinned ? '对话已置顶' : '已取消置顶', 'success');
            }
        }
    },

    async shareConversation(id) {
        this.closeAllDropdowns();
        
        const conversations = Utils.storage.get('guest_conversations') || [];
        const conversation = conversations.find(c => c.id === id);
        
        if (!conversation) {
            this.showToast('找不到对话', 'error');
            return;
        }

        const shareContent = `【${conversation.title}】\n${'-'.repeat(30)}\n${(conversation.messages || []).map(msg => {
            const role = msg.role === 'user' ? '👤 用户' : '🤖 助手';
            return `${role}：\n${msg.content}`;
        }).join('\n\n')}`;

        try {
            await Utils.copyToClipboard(shareContent);
            this.showToast('对话内容已复制到剪贴板', 'success');
        } catch (error) {
            this.showToast('复制失败，请重试', 'error');
        }
    },

    async showDeleteDialog(id) {
        this.closeAllDropdowns();
        
        let conversation = this.allConversations.find(c => c.id === id);
        
        if (!conversation) {
            if (!Auth.isLoggedIn() || Auth.isGuest) {
                const conversations = Utils.storage.get('guest_conversations') || [];
                conversation = conversations.find(c => c.id === id);
            }
        }
        
        if (!conversation) {
            this.showToast('找不到对话', 'error');
            return false;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-dialog-header">
                    <div class="confirm-dialog-icon danger">🗑️</div>
                    <h3>删除对话</h3>
                </div>
                <div class="confirm-dialog-body">
                    <p>确定要删除对话「${Utils.escapeHtml(conversation.title)}」吗？</p>
                    <p class="confirm-dialog-warning">此操作将永久删除该对话及所有消息记录，无法恢复。</p>
                </div>
                <div class="confirm-dialog-footer">
                    <button class="confirm-btn cancel">取消</button>
                    <button class="confirm-btn danger">删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.confirm-btn.cancel');
        const deleteBtn = overlay.querySelector('.confirm-btn.danger');

        const closeModal = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        };

        cancelBtn.addEventListener('click', closeModal);
        
        deleteBtn.addEventListener('click', async () => {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '删除中...';
            
            await this.deleteConversation(id, true);
            closeModal();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });

        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        return false;
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
        if (this.isCreatingNew) return;
        this.isCreatingNew = true;

        try {
            this.messages = [];
            this.uploadedImages = [];
            this.userScrolledUp = false;
            
            if (!Auth.isLoggedIn() || Auth.isGuest) {
                this.currentConversationId = Utils.generateId();
            } else {
                this.currentConversationId = null;
            }
            
            const inputEl = document.getElementById('messageInput');
            if (inputEl) {
                inputEl.value = '';
                this.autoResize();
            }
            
            const uploadedImagesContainer = document.getElementById('uploadedImages');
            if (uploadedImagesContainer) {
                uploadedImagesContainer.innerHTML = '';
            }
            
            const titleEl = document.getElementById('chatTitle');
            if (titleEl) {
                titleEl.textContent = '新对话';
            }

            this.clearMessagesContainer();
            
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            
            this.updateSendButton();

            if (Utils.isMobile()) {
                this.collapseSidebar();
            }
        } finally {
            setTimeout(() => {
                this.isCreatingNew = false;
            }, 300);
        }
    },

    async createConversationOnBackend(title = '新对话', model = 'deepseek') {
        try {
            const result = await API.conversations.create(title, model);
            if (result.code === 200 && result.data) {
                this.currentConversationId = result.data.id;
                
                this.allConversations = [result.data, ...this.allConversations];
                this.renderConversations(this.allConversations);
                
                return result.data;
            }
        } catch (error) {
            console.error('创建对话失败:', error);
        }
        return null;
    },

    async updateConversationTitleOnBackend() {
        if (!this.currentConversationId || !this.messages) return;
        
        const title = this.generateConversationTitle(this.messages);
        
        try {
            await API.conversations.update(this.currentConversationId, { title });
            
            const convIndex = this.allConversations.findIndex(c => c.id === this.currentConversationId);
            if (convIndex >= 0) {
                this.allConversations[convIndex].title = title;
                this.allConversations[convIndex].updated_at = new Date().toISOString();
                this.renderConversations(this.allConversations);
            }
            
            const titleEl = document.getElementById('chatTitle');
            if (titleEl) {
                titleEl.textContent = title;
            }
        } catch (error) {
            console.error('更新对话标题失败:', error);
        }
    },

    clearMessagesContainer() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        const emptyState = document.getElementById('emptyState');
        
        if (emptyState && emptyState.parentNode) {
            emptyState.parentNode.removeChild(emptyState);
        }
        
        container.innerHTML = '';
        
        if (emptyState) {
            emptyState.style.display = 'flex';
            container.appendChild(emptyState);
        } else {
            this.displayEmptyState();
        }
    },

    displayEmptyState() {
        const container = document.getElementById('messagesContainer');
        const existingEmpty = document.getElementById('emptyState');
        
        if (!container) return;
        
        if (existingEmpty) {
            existingEmpty.style.display = 'flex';
            if (!container.contains(existingEmpty)) {
                container.innerHTML = '';
                container.appendChild(existingEmpty);
            }
        } else {
            container.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <div class="empty-icon">🤖</div>
                    <h2 class="empty-title">您好，我是 GyAI 工业助手</h2>
                    <p class="empty-desc">
                        我可以帮您解答工业技术问题、分析设备故障、
                        提供工艺优化建议等。请选择下方问题或直接输入您的问题。
                    </p>
                    <div class="empty-suggestions">
                        <button class="suggestion-chip" data-question="如何进行设备日常维护保养？">
                            设备维护保养
                        </button>
                        <button class="suggestion-chip" data-question="常见的设备故障有哪些，如何诊断？">
                            故障诊断方法
                        </button>
                        <button class="suggestion-chip" data-question="如何优化生产工艺流程？">
                            工艺优化建议
                        </button>
                        <button class="suggestion-chip" data-question="安全生产有哪些注意事项？">
                            安全生产规范
                        </button>
                    </div>
                </div>
            `;
            
            this.bindSuggestionChips();
        }
        
        this.updateScrollButtonVisibility();
    },

    bindSuggestionChips() {
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
    },

    saveGuestConversation(id, title) {
        if (!this.storageSettings.saveHistory) {
            return;
        }

        const conversations = Utils.storage.get('guest_conversations') || [];
        const existingIndex = conversations.findIndex(c => c.id === id);
        const now = new Date().toISOString();
        
        const existingConversation = existingIndex >= 0 ? conversations[existingIndex] : null;
        
        const conversation = {
            id: id,
            title: title,
            model: this.currentModel,
            messages: this.messages,
            pinned: existingConversation?.pinned || false,
            created_at: existingConversation?.created_at || now,
            updated_at: now
        };

        if (existingIndex >= 0) {
            conversations[existingIndex] = conversation;
        } else {
            conversations.unshift(conversation);
        }

        Utils.storage.set('guest_conversations', conversations);
        
        this.allConversations = this.sortConversations(conversations);
        this.renderConversations(this.allConversations);
    },

    async deleteConversation(id, skipConfirm = false) {
        if (!skipConfirm) {
            return this.showDeleteDialog(id);
        }
        
        if (Auth.isLoggedIn() && !Auth.isGuest) {
            try {
                const result = await API.conversations.delete(id);
                if (result.code === 200) {
                    this.handleDeleteSuccess(id);
                    return true;
                } else {
                    this.showToast('删除失败', 'error');
                    return false;
                }
            } catch (error) {
                console.error('删除对话失败:', error);
                this.showToast('删除失败，请重试', 'error');
                return false;
            }
        } else {
            let conversations = Utils.storage.get('guest_conversations') || [];
            const convIndex = conversations.findIndex(c => c.id === id);
            
            if (convIndex >= 0) {
                conversations.splice(convIndex, 1);
                Utils.storage.set('guest_conversations', conversations);
                
                this.allConversations = this.allConversations.filter(c => c.id !== id);
                this.renderConversations(this.allConversations);
                
                if (this.currentConversationId === id) {
                    this.clearCurrentConversation();
                }
                
                this.showToast('对话已删除', 'success');
                return true;
            }
            
            this.allConversations = this.allConversations.filter(c => c.id !== id);
            this.renderConversations(this.allConversations);
            
            if (this.currentConversationId === id) {
                this.clearCurrentConversation();
            }
            
            this.showToast('对话已删除', 'success');
            return true;
        }
    },

    handleDeleteSuccess(id) {
        const wasCurrentConversation = this.currentConversationId === id;
        
        this.allConversations = this.allConversations.filter(c => c.id !== id);
        this.renderConversations(this.allConversations);
        
        if (wasCurrentConversation) {
            this.clearCurrentConversation();
        }
        
        this.showToast('对话已删除', 'success');
    },

    clearCurrentConversation() {
        this.messages = [];
        this.currentConversationId = null;
        this.uploadedImages = [];
        this.userScrolledUp = false;
        
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isGenerating = false;
        
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
            this.scrollAnimationFrame = null;
        }
        
        const inputEl = document.getElementById('messageInput');
        if (inputEl) {
            inputEl.value = '';
            this.autoResize();
        }
        
        const uploadedImagesContainer = document.getElementById('uploadedImages');
        if (uploadedImagesContainer) {
            uploadedImagesContainer.innerHTML = '';
        }
        
        this.clearMessagesContainer();
        
        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = '新对话';
        }
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.updateUI();
    },

    renderMessages() {
        const container = document.getElementById('messagesContainer');

        if (!container) return;

        if (this.messages.length === 0) {
            this.displayEmptyState();
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        const fragment = document.createDocumentFragment();
        const lastMsg = this.messages[this.messages.length - 1];
        const isLastAssistant = lastMsg && lastMsg.role === 'assistant' && !this.isGenerating;

        this.messages.forEach((msg, index) => {
            const isLast = index === this.messages.length - 1;
            const html = this.createMessageHTML(msg, isLast && isLastAssistant);
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            const element = template.content.firstChild;
            
            if (element && this.performanceOpt.observerInstance) {
                this.performanceOpt.observerInstance.observe(element);
            }
            
            fragment.appendChild(element);
        });

        requestAnimationFrame(() => {
            container.innerHTML = '';
            container.appendChild(fragment);

            if (!this.userScrolledUp) {
                this.scrollToBottom(true);
            }
            this.updateScrollButtonVisibility();
        });
    },

    updateScrollButtonVisibility() {
        const container = document.getElementById('chatMessages');
        const scrollBtn = document.getElementById('scrollToBottomBtn');
        if (!container || !scrollBtn) return;

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        scrollBtn.classList.toggle('visible', !isNearBottom && this.messages.length > 0);
    },

    createMessageHTML(msg, isLastAssistant = false) {
        const isUser = msg.role === 'user';
        const time = TimeUtils.format(msg.created_at);

        let content;
        if (isUser) {
            content = Utils.formatMarkdown(msg.content);
            if (msg.images && msg.images.length > 0) {
                content += `<div class="message-images">${msg.images.map(img => 
                    `<img data-src="${img}" alt="上传图片" class="message-image lazy-load">`
                ).join('')}</div>`;
            }
        } else {
            if (!msg.content || msg.content.trim() === '') {
                content = `
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                `;
            } else {
                content = Utils.formatMarkdown(msg.content);
            }
        }

        const hasContent = msg.content && msg.content.trim();
        const isStopped = msg.isStopped || false;
        const showContinue = !isUser && hasContent && isLastAssistant && !this.isGenerating && isStopped;
        const showRegenerate = !isUser && hasContent && isLastAssistant && !this.isGenerating;
        const showCopy = !isUser && hasContent && (!isLastAssistant || !this.isGenerating);

        let assistantActions = '';
        if (showContinue || showRegenerate || showCopy) {
            assistantActions = `
                <div class="message-actions assistant-actions">
                    <div class="action-buttons-left">
                        ${showRegenerate ? `
                            <button class="message-action regenerate-btn" title="重新生成">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                                    <path d="M21 3v5h-5"/>
                                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                                    <path d="M8 16H3v5"/>
                                </svg>
                            </button>
                        ` : ''}
                        ${showCopy ? `
                            <button class="message-action copy-btn" title="复制">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                    ${showContinue ? `
                        <button class="message-action continue-btn" title="继续回答">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            <span>继续回答</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div class="message ${msg.role}" data-message-id="${msg.id}">
                <div class="message-avatar">${isUser ? '👤' : '🤖'}</div>
                <div class="message-content">
                    <div class="message-bubble" style="display: block; visibility: visible; opacity: 1;">${content}</div>
                    <div class="message-time">${time}</div>
                    ${isUser ? `
                        <div class="message-actions">
                            <button class="message-action edit-btn" title="重新编辑">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="message-action copy-btn" title="复制">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        </div>
                    ` : assistantActions}
                </div>
            </div>
        `;
    },

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input?.value.trim();

        if (!message && this.uploadedImages.length === 0) return;
        if (this.isGenerating) return;

        this.userScrolledUp = false;

        if (!this.currentConversationId) {
            this.clearMessagesContainer();
            
            if (Auth.isLoggedIn() && !Auth.isGuest) {
                await this.createConversationOnBackend('新对话', this.currentModel);
            } else {
                await this.createNewConversation();
            }
        }

        const userMessage = {
            id: Utils.generateId(),
            role: 'user',
            content: message,
            images: this.uploadedImages.map(img => img.data),
            created_at: new Date().toISOString()
        };

        this.messages.push(userMessage);
        this.lastUserMessage = userMessage;
        
        // 更新标题为首条用户消息
        if (this.messages.filter(m => m.role === 'user').length === 1) {
            const title = this.generateConversationTitle(this.messages);
            const titleEl = document.getElementById('chatTitle');
            if (titleEl) {
                titleEl.textContent = title;
            }
        }
        
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
        this.renderMessages();

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                const history = this.messages.slice(0, -1).map(m => ({
                    role: m.role,
                    content: m.content
                }));

                const response = await API.chat.stream(message, {
                    model: this.currentModel,
                    history: history,
                    images: images,
                    conversationId: this.currentConversationId,
                    signal: signal
                });

                await SSEClient.processStream(response, {
                    onContent: (content) => {
                        if (signal.aborted) return;
                        assistantMessage.content += content;
                        this.updateLastMessage(assistantMessage.content);
                    },
                    onError: (error) => {
                        if (signal.aborted) return;
                        if (retryCount < maxRetries && (error.includes('超时') || error.includes('网络'))) {
                            retryCount++;
                            assistantMessage.content = '';
                            this.updateLastMessage('');
                            return;
                        }
                        assistantMessage.content = `错误：${error}`;
                        this.updateLastMessage(assistantMessage.content);
                        this.isGenerating = false;
                        assistantMessage.isStopped = true;
                        this.updateUI();
                        this.renderMessages();
                    },
                    onDone: () => {
                        if (signal.aborted) return;
                        this.isGenerating = false;
                        this.abortController = null;
                        this.updateUI();
                        
                        this.renderMessages();

                        if (!Auth.isLoggedIn() || Auth.isGuest) {
                            const title = this.generateConversationTitle(this.messages);
                            this.saveGuestConversation(this.currentConversationId, title);
                        } else if (this.currentConversationId) {
                            this.updateConversationTitleOnBackend();
                        }
                    }
                }, signal);

                return;

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('生成已中止');
                    this.isGenerating = false;
                    this.abortController = null;
                    assistantMessage.isStopped = true;
                    this.updateUI();
                    this.renderMessages();
                    return;
                }

                console.error('生成响应失败:', error);

                if (retryCount < maxRetries) {
                    retryCount++;
                    assistantMessage.content = '';
                    this.updateLastMessage('');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                assistantMessage.content = '抱歉，发生了错误，请稍后重试。';
                this.updateLastMessage(assistantMessage.content);
                this.isGenerating = false;
                this.abortController = null;
                assistantMessage.isStopped = true;
                this.updateUI();
                this.renderMessages();
                return;
            }
        }
    },

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        this.isGenerating = false;
        this.updateUI();

        const messages = document.querySelectorAll('.message.assistant');
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
            const bubble = lastMessage.querySelector('.message-bubble');
            if (bubble) {
                const content = bubble.textContent || '';
                if (!content || content.includes('typing-dot')) {
                    bubble.innerHTML = '<div class="stopped-message">⏸ 已停止生成</div>';
                } else {
                    const stoppedIndicator = document.createElement('div');
                    stoppedIndicator.className = 'stopped-indicator';
                    stoppedIndicator.innerHTML = '⏸ 已停止';
                    bubble.appendChild(stoppedIndicator);
                }
            }
        }

        const lastAssistantMsg = this.messages.filter(m => m.role === 'assistant').pop();
        if (lastAssistantMsg) {
            lastAssistantMsg.isStopped = true;
        }

        this.renderMessages();
        this.showToast('已停止生成', 'info');
    },

    async regenerateResponse() {
        if (this.isGenerating) {
            this.showToast('请先停止当前生成', 'warning');
            return;
        }

        const lastUserMsg = this.messages.filter(m => m.role === 'user').pop();
        
        if (!lastUserMsg) {
            this.showToast('没有可重新生成的对话', 'warning');
            return;
        }

        const lastAssistantIndex = this.messages.length - 1;
        if (this.messages[lastAssistantIndex] && this.messages[lastAssistantIndex].role === 'assistant') {
            this.messages.pop();
        }

        this.renderMessages();

        await this.generateResponse(lastUserMsg.content, lastUserMsg.images);
    },

    editMessage(messageId) {
        if (this.isGenerating) {
            this.showToast('请先停止当前生成', 'warning');
            return;
        }

        const message = this.messages.find(m => m.id === messageId);

        if (!message || message.role !== 'user') {
            console.error('消息未找到或不是用户消息');
            return;
        }

        const input = document.getElementById('messageInput');
        if (!input) {
            console.error('输入框未找到');
            return;
        }

        input.value = message.content;

        if (message.images && message.images.length > 0) {
            this.uploadedImages = message.images.map((img, index) => ({
                id: `img_${Date.now()}_${index}`,
                data: img,
                name: `图片${index + 1}`
            }));
            this.renderUploadedImages();
        } else {
            this.uploadedImages = [];
            this.renderUploadedImages();
        }

        this.autoResize();
        this.updateSendButton();

        input.focus();

        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.classList.add('editing');
            setTimeout(() => {
                messageElement.classList.remove('editing');
            }, 2000);
        }

        this.showToast('已加载到输入框，可重新编辑', 'success');

        this.userScrolledUp = false;
        this.scrollToBottom(true);
    },

    async continueResponse() {
        if (this.isGenerating) {
            this.showToast('正在生成中，请稍候', 'warning');
            return;
        }

        if (!this.lastUserMessage) {
            this.showToast('没有可继续的回答', 'warning');
            return;
        }

        const lastAssistantMsg = this.messages.filter(m => m.role === 'assistant').pop();
        
        if (!lastAssistantMsg || !lastAssistantMsg.content) {
            this.showToast('没有可继续的内容', 'warning');
            return;
        }

        const existingContent = lastAssistantMsg.content;
        
        lastAssistantMsg.isStopped = false;
        this.renderMessages();

        const history = this.messages.slice(0, -1).map(m => ({
            role: m.role,
            content: m.content
        }));

        const continuePrompt = `\n\n（请继续上面的回答，保持内容连贯，不要重复已生成的内容）`;

        this.showToast('正在继续生成...', 'info');

        await this.generateContinue(existingContent, continuePrompt, history);
    },

    async generateContinue(existingContent, prompt, history) {
        this.isGenerating = true;
        this.updateUI();

        const lastAssistantMsg = this.messages.filter(m => m.role === 'assistant').pop();
        if (!lastAssistantMsg) {
            this.isGenerating = false;
            this.updateUI();
            return;
        }

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                const response = await API.chat.stream(prompt, {
                    model: this.currentModel,
                    history: history,
                    images: null,
                    conversationId: this.currentConversationId,
                    signal: signal
                });

                await SSEClient.processStream(response, {
                    onContent: (content) => {
                        if (signal.aborted) return;
                        lastAssistantMsg.content += content;
                        this.updateLastMessage(lastAssistantMsg.content);
                    },
                    onError: (error) => {
                        if (signal.aborted) return;
                        if (retryCount < maxRetries && (error.includes('超时') || error.includes('网络'))) {
                            retryCount++;
                            return;
                        }
                        this.isGenerating = false;
                        lastAssistantMsg.isStopped = true;
                        this.updateUI();
                        this.renderMessages();
                    },
                    onDone: () => {
                        if (signal.aborted) return;
                        this.isGenerating = false;
                        this.abortController = null;
                        this.updateUI();
                        this.renderMessages();

                        if (!Auth.isLoggedIn() || Auth.isGuest) {
                            const title = this.generateConversationTitle(this.messages);
                            this.saveGuestConversation(this.currentConversationId, title);
                        } else if (this.currentConversationId) {
                            this.updateConversationTitleOnBackend();
                        }
                    }
                }, signal);

                return;

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('继续生成已中止');
                    this.isGenerating = false;
                    this.abortController = null;
                    lastAssistantMsg.isStopped = true;
                    this.updateUI();
                    this.renderMessages();
                    return;
                }

                console.error('继续生成失败:', error);

                if (retryCount < maxRetries) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                this.isGenerating = false;
                lastAssistantMsg.isStopped = true;
                this.updateUI();
                this.renderMessages();
                return;
            }
        }
    },

    compressContext(history) {
        if (history.length <= 4) return history;
        
        const recentHistory = history.slice(-4);
        const olderHistory = history.slice(0, -4);
        
        let summary = '';
        olderHistory.forEach(msg => {
            if (msg.role === 'user') {
                summary += `用户问：${msg.content.slice(0, 50)}... `;
            } else {
                summary += `AI答：${msg.content.slice(0, 100)}... `;
            }
        });
        
        return [
            { role: 'system', content: `历史对话摘要：${summary}` },
            ...recentHistory
        ];
    },

    getGenerationState() {
        return this.generationState;
    },

    getEditHistory(messageId) {
        return this.editHistory[messageId] || [];
    },

    clearEditHistory(messageId) {
        if (messageId) {
            delete this.editHistory[messageId];
        } else {
            this.editHistory = {};
        }
    },

    // ========== 修改点：updateLastMessage 支持空内容显示打字指示器 ==========
    updateLastMessage(content) {
        const messages = document.querySelectorAll('.message.assistant');
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
            const bubble = lastMessage.querySelector('.message-bubble');
            if (bubble) {
                if (!content) {
                    // 内容为空时显示打字指示器
                    bubble.innerHTML = `
                        <div class="typing-indicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    `;
                } else {
                    bubble.innerHTML = Utils.formatMarkdown(content);
                }
                bubble.style.display = 'block';
                bubble.style.visibility = 'visible';
                bubble.style.opacity = '1';
            }
        }

        this.requestScrollUpdate();
    },
    // ===============================================================

    scrollAnimationFrame: null,

    requestScrollUpdate() {
        if (this.scrollAnimationFrame) return;

        this.scrollAnimationFrame = requestAnimationFrame(() => {
            const container = document.getElementById('chatMessages');
            if (container) {
                if (!this.userScrolledUp) {
                    container.scrollTop = container.scrollHeight;
                }
            }
            this.scrollAnimationFrame = null;
        });
    },

    scrollToBottom(force = false) {
        const container = document.getElementById('chatMessages');
        if (container) {
            if (force || !this.userScrolledUp) {
                requestAnimationFrame(() => {
                    container.scrollTop = container.scrollHeight;
                    this.userScrolledUp = false;
                });
            }
        }
    },

    scrollToEnd() {
        this.userScrolledUp = false;
        this.scrollToBottom(true);
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

        if (this.currentConversationId) {
            await this.deleteConversation(this.currentConversationId, true);
        } else {
            this.messages = [];
            this.renderMessages();
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
        if (!content || typeof content !== 'string') {
            this.showToast('没有可复制的内容', 'warning');
            return;
        }

        const cleanContent = content.replace(/\s+/g, ' ').trim();
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(cleanContent)
                .then(() => {
                    this.showToast('✅ 已复制到剪贴板', 'success');
                })
                .catch(() => {
                    this.fallbackCopy(cleanContent);
                });
        } else {
            this.fallbackCopy(cleanContent);
        }
    },

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            this.showToast(successful ? '✅ 已复制到剪贴板' : '❌ 复制失败', 
                          successful ? 'success' : 'error');
        } catch (err) {
            this.showToast('❌ 复制失败', 'error');
        }
        
        document.body.removeChild(textarea);
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

    toggleMonitor() {
        window.location.href = '/monitor';
    },

    async clearLocalData() {
        const confirmed = await ConfirmDialog.show({
            title: '清空所有对话历史',
            message: '确定要清空所有本地存储的对话记录吗？此操作将删除所有对话，包括可能存在的异常数据。',
            confirmText: '清空',
            cancelText: '取消',
            type: 'danger',
            showWarning: true,
            warningText: '清空后可在30秒内撤销恢复'
        });

        if (!confirmed) return;

        const inputEl = document.getElementById('messageInput');
        const currentInput = inputEl ? inputEl.value : '';

        this.clearHistory.backup = {
            conversations: Utils.storage.get('guest_conversations') || [],
            messages: [...this.messages],
            currentConversationId: this.currentConversationId,
            currentInput: currentInput,
            uploadedImages: [...this.uploadedImages],
            allConversations: [...this.allConversations],
            userScrolledUp: this.userScrolledUp,
            lastScrollTop: this.lastScrollTop
        };

        Utils.storage.remove('guest_conversations');
        
        this.allConversations = [];
        this.messages = [];
        this.currentConversationId = null;
        this.uploadedImages = [];
        this.userScrolledUp = false;
        
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isGenerating = false;
        
        const container = document.getElementById('conversationList');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-muted);">
                    暂无对话记录
                </div>
            `;
        }
        
        this.clearMessagesContainer();
        
        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = '新对话';
        }
        
        if (inputEl) {
            inputEl.value = '';
            this.autoResize();
        }
        
        const uploadedImagesContainer = document.getElementById('uploadedImages');
        if (uploadedImagesContainer) {
            uploadedImagesContainer.innerHTML = '';
        }
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.updateUI();

        this.showUndoToast('对话历史已清空', 30);

        this.startClearCountdown();
    },

    performFullClear() {
        this.messages = [];
        this.currentConversationId = null;
        this.uploadedImages = [];
        this.userScrolledUp = false;
        this.allConversations = [];
        this.lastScrollTop = 0;
        
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isGenerating = false;
        
        if (this.performanceOpt.domCache) {
            this.performanceOpt.domCache.clear();
        }
        if (this.performanceOpt.observerInstance) {
            this.performanceOpt.observerInstance.disconnect();
        }
        if (this.performanceOpt.scrollRAF) {
            cancelAnimationFrame(this.performanceOpt.scrollRAF);
            this.performanceOpt.scrollRAF = null;
        }
        
        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
            this.scrollAnimationFrame = null;
        }
        
        this.updateUI();
        
        const inputEl = document.getElementById('messageInput');
        if (inputEl) {
            inputEl.value = '';
            this.autoResize();
        }
        
        const uploadedImagesContainer = document.getElementById('uploadedImages');
        if (uploadedImagesContainer) {
            uploadedImagesContainer.innerHTML = '';
        }
        
        this.clearMessagesContainer();
        
        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = '新对话';
        }
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.updateSendButton();
    },

    showEmptyState() {
        this.displayEmptyState();
        
        const titleEl = document.getElementById('chatTitle');
        if (titleEl) {
            titleEl.textContent = '新对话';
        }
    },

    showUndoToast(message, countdown) {
        const container = document.getElementById('uploadStatusContainer');
        if (!container) return;

        const existingUndo = container.querySelector('.undo-toast');
        if (existingUndo) existingUndo.remove();

        const toast = document.createElement('div');
        toast.className = 'upload-status success undo-toast';
        toast.innerHTML = `
            <span class="undo-message">${message}</span>
            <span class="undo-countdown">${countdown}秒后不可恢复</span>
            <button class="undo-btn" id="undoClearBtn">撤销</button>
        `;
        container.appendChild(toast);

        const undoBtn = toast.querySelector('#undoClearBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoClear());
        }
    },

    startClearCountdown() {
        if (this.clearHistory.timer) {
            clearInterval(this.clearHistory.timer);
        }

        this.clearHistory.countdown = 30;

        this.clearHistory.timer = setInterval(() => {
            this.clearHistory.countdown--;

            const countdownEl = document.querySelector('.undo-countdown');
            if (countdownEl) {
                countdownEl.textContent = `${this.clearHistory.countdown}秒后不可恢复`;
            }

            if (this.clearHistory.countdown <= 0) {
                clearInterval(this.clearHistory.timer);
                this.clearHistory.timer = null;
                this.clearHistory.backup = null;

                const undoToast = document.querySelector('.undo-toast');
                if (undoToast) {
                    undoToast.remove();
                }
            }
        }, 1000);
    },

    undoClear() {
        if (!this.clearHistory.backup) {
            this.showToast('无法恢复：备份已过期', 'error');
            return;
        }

        if (this.clearHistory.timer) {
            clearInterval(this.clearHistory.timer);
            this.clearHistory.timer = null;
        }

        const backup = this.clearHistory.backup;
        this.clearHistory.backup = null;

        Utils.storage.set('guest_conversations', backup.conversations);
        this.messages = backup.messages || [];
        this.currentConversationId = backup.currentConversationId;
        this.uploadedImages = backup.uploadedImages || [];
        this.allConversations = backup.allConversations || [];
        this.userScrolledUp = backup.userScrolledUp || false;
        this.lastScrollTop = backup.lastScrollTop || 0;

        const inputEl = document.getElementById('messageInput');
        if (inputEl && backup.currentInput) {
            inputEl.value = backup.currentInput;
            this.autoResize();
        }
        
        this.renderUploadedImages();
        this.updateSendButton();
        this.renderMessages();
        this.loadConversations();

        const undoToast = document.querySelector('.undo-toast');
        if (undoToast) {
            undoToast.remove();
        }

        this.showToast('对话历史已恢复', 'success');
    },

    getDurationText(duration) {
        const texts = {
            0: '永久保存',
            1: '1天',
            7: '7天',
            30: '30天'
        };
        return texts[duration] || `${duration}天`;
    },

    async cleanExpiredMessages() {
        const duration = this.storageSettings.duration;
        
        if (duration === 0) {
            this.showToast('当前设置为永久保存，无需清理', 'info');
            return;
        }

        const conversations = Utils.storage.get('guest_conversations') || [];
        const now = Date.now();
        const expireTime = duration * 24 * 60 * 60 * 1000;
        
        let cleanedCount = 0;
        const validConversations = conversations.filter(conv => {
            const createdTime = new Date(conv.created_at).getTime();
            const isExpired = (now - createdTime) > expireTime;
            if (isExpired) {
                cleanedCount++;
            }
            return !isExpired;
        });

        if (cleanedCount === 0) {
            this.showToast('没有过期的对话记录', 'info');
            return;
        }

        Utils.storage.set('guest_conversations', validConversations);
        await this.loadConversations();
        
        if (this.currentConversationId) {
            const currentExists = validConversations.some(c => c.id === this.currentConversationId);
            if (!currentExists) {
                this.currentConversationId = null;
                this.messages = [];
                this.renderMessages();
                this.showEmptyState();
            }
        }

        this.showToast(`已清理 ${cleanedCount} 条过期对话`, 'success');
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

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    Chat.init();
});