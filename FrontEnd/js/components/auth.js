/**
 * 认证组件
 * 处理用户登录、注册
 * 游客模式：未登录用户可直接使用基础功能
 */

const Auth = {
    currentUser: null,
    isGuest: false,
    isModalOpen: false,
    initialized: false,
    
    async init() {
        if (this.initialized) return;
        this.initialized = true;
        
        const hasSession = await this.checkSession();
        if (!hasSession) {
            await this.loginAsGuest();
        }
        this.bindEvents();
    },
    
    async checkSession() {
        try {
            const result = await API.auth.me();
            if (result.code === 200 && result.data) {
                this.currentUser = result.data;
                this.isGuest = result.data.is_guest || false;
                this.updateUI();
                return true;
            }
        } catch (error) {
            console.error('检查会话失败:', error);
        }
        return false;
    },
    
    enableGuestMode() {
        this.currentUser = {
            username: '游客',
            nickname: '游客',
            is_guest: true
        };
        this.isGuest = true;
        this.updateUI();
    },
    
    bindEvents() {
        const loginBtn = document.getElementById('loginBtn');
        const guestBtn = document.getElementById('guestBtn');
        const guestModeBtn = document.getElementById('guestModeBtn');
        const closeModal = document.getElementById('closeModal');
        const authModal = document.getElementById('authModal');
        const authTabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showModal());
        }
        
        if (guestBtn) {
            guestBtn.addEventListener('click', () => this.loginAsGuest());
        }
        
        if (guestModeBtn) {
            guestModeBtn.addEventListener('click', () => this.loginAsGuest());
        }
        
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal());
        }
        
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal) {
                    this.hideModal();
                }
            });
        }
        
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.dataset.tab;
                if (tabName === 'login') {
                    loginForm && loginForm.classList.remove('hidden');
                    registerForm && registerForm.classList.add('hidden');
                } else {
                    loginForm && loginForm.classList.add('hidden');
                    registerForm && registerForm.classList.remove('hidden');
                }
                
                this.hideError();
                this.hideSuccess();
            });
        });
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
            }
        });
    },
    
    showModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('active');
            const firstInput = modal.querySelector('input');
            firstInput && firstInput.focus();
        }
    },
    
    hideModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.hideError();
        this.hideSuccess();
    },
    
    showError(message) {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    },
    
    hideError() {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.classList.remove('show');
        }
    },
    
    showSuccess(message) {
        const successEl = document.getElementById('authSuccess');
        if (successEl) {
            successEl.textContent = message;
            successEl.classList.add('show');
        }
    },
    
    hideSuccess() {
        const successEl = document.getElementById('authSuccess');
        if (successEl) {
            successEl.classList.remove('show');
        }
    },
    
    async handleLogin() {
        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        
        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }
        
        try {
            const result = await API.auth.login(username, password);
            console.log('登录响应:', result);
            
            if (result.code === 200 && result.data) {
                this.currentUser = result.data.user;
                this.isGuest = false;
                Utils.cookie.set('gyai_session', result.data.token);
                this.hideModal();
                this.updateUI();
                this.onAuthSuccess();
            } else {
                this.showError(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showError('登录失败，请稍后重试');
        }
    },
    
    async handleRegister() {
        const username = document.getElementById('registerUsername')?.value.trim();
        const email = document.getElementById('registerEmail')?.value.trim() || null;
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
        
        if (!username || !password) {
            this.showError('请填写必填项');
            return;
        }
        
        if (username.length < 3 || username.length > 20) {
            this.showError('用户名长度需在3-20个字符之间');
            return;
        }
        
        if (password.length < 6) {
            this.showError('密码长度至少6个字符');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('两次输入的密码不一致');
            return;
        }
        
        try {
            const result = await API.auth.register(username, password, email);
            console.log('注册响应:', result);
            
            if (result.code === 200) {
                this.showSuccess('注册成功，请登录');
                setTimeout(() => {
                    document.querySelector('.auth-tab[data-tab="login"]')?.click();
                    const loginUsername = document.getElementById('loginUsername');
                    if (loginUsername) {
                        loginUsername.value = username;
                    }
                }, 1500);
            } else {
                this.showError(result.message || '注册失败');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showError('注册失败，请稍后重试');
        }
    },
    
    async loginAsGuest() {
        try {
            const result = await API.auth.guest();
            
            if (result.code === 200 && result.data) {
                this.currentUser = result.data.user;
                this.isGuest = true;
                Utils.cookie.set('gyai_session', result.data.token);
                this.hideModal();
                this.updateUI();
                this.onAuthSuccess();
            } else {
                this.showError(result.message || '创建游客账户失败');
            }
        } catch (error) {
            this.showError('创建游客账户失败，请稍后重试');
        }
    },
    
    async logout() {
        try {
            await API.auth.logout();
        } catch (error) {
            console.error('登出失败:', error);
        }
        
        Utils.cookie.remove('gyai_session');
        this.currentUser = null;
        this.isGuest = false;
        this.updateUI();
        window.location.href = '/';
    },
    
    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userPlan = document.getElementById('userPlan');
        const userIconAvatar = document.getElementById('userIconAvatar');
        const userMenu = document.getElementById('userMenu');
        const dropdownLogin = document.getElementById('dropdownLogin');
        
        if (this.currentUser) {
            if (loginBtn) {
                if (this.isGuest) {
                    loginBtn.textContent = '登录';
                    loginBtn.onclick = () => this.showModal();
                } else {
                    loginBtn.textContent = '退出';
                    loginBtn.onclick = () => this.logout();
                }
            }
            
            if (userName) {
                userName.textContent = this.currentUser.nickname || this.currentUser.username || '用户';
            }
            
            if (userAvatar) {
                const name = this.currentUser.nickname || this.currentUser.username || 'U';
                userAvatar.textContent = name.charAt(0).toUpperCase();
            }
            
            if (userIconAvatar) {
                const name = this.currentUser.nickname || this.currentUser.username || 'U';
                userIconAvatar.textContent = name.charAt(0).toUpperCase();
            }
            
            if (userPlan) {
                userPlan.textContent = this.isGuest ? '未登录' : '免费版';
            }
            
            if (userMenu) {
                if (this.isGuest) {
                    userMenu.classList.remove('logged-in');
                } else {
                    userMenu.classList.add('logged-in');
                }
            }
            
            // 更新下拉菜单中的登录/退出登录选项
            if (dropdownLogin) {
                const spanEl = dropdownLogin.querySelector('span');
                if (spanEl) {
                    if (this.isGuest) {
                        spanEl.textContent = '登录';
                        // 更新图标为登录图标
                        dropdownLogin.querySelector('svg').innerHTML = '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>';
                    } else {
                        spanEl.textContent = '退出登录';
                        // 更新图标为退出登录图标
                        dropdownLogin.querySelector('svg').innerHTML = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
                    }
                }
            }
        }
    },
    
    onAuthSuccess() {
        const startChatBtn = document.getElementById('startChatBtn');
        const ctaStartBtn = document.getElementById('ctaStartBtn');
        
        if (startChatBtn) {
            window.location.href = '/chat';
        }
    },
    
    handleUnauthorized() {
        this.currentUser = null;
        this.isGuest = false;
        Utils.cookie.remove('gyai_session');
        this.updateUI();
    },
    
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    getUser() {
        return this.currentUser;
    }
};
