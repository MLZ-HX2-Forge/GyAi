/**
 * 主页面组件
 */

const Landing = {
    async init() {
        this.showLoadingState();
        this.bindEvents();
        this.initScrollEffects();
        this.initAnimations();
        this.initParticles();
        this.hideLoadingState();
    },
    
    showLoadingState() {
        const existingOverlay = document.getElementById('pageLoadingOverlay');
        if (existingOverlay) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'pageLoadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s ease-out;
        `;
        overlay.innerHTML = `
            <div class="loading-spinner" style="
                width: 40px;
                height: 40px;
                border: 3px solid var(--border-color);
                border-top-color: var(--primary-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></div>
        `;
        document.body.appendChild(overlay);
    },
    
    hideLoadingState() {
        const overlay = document.getElementById('pageLoadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    },
    
    bindEvents() {
        const startChatBtn = document.getElementById('startChatBtn');
        const watchDemoBtn = document.getElementById('watchDemoBtn');
        const ctaStartBtn = document.getElementById('ctaStartBtn');
        const contactBtn = document.getElementById('contactBtn');
        
        if (startChatBtn) {
            startChatBtn.addEventListener('click', () => {
                if (Auth.isLoggedIn()) {
                    window.location.href = '/chat';
                } else {
                    Auth.showModal();
                }
            });
        }
        
        if (ctaStartBtn) {
            ctaStartBtn.addEventListener('click', () => {
                if (Auth.isLoggedIn()) {
                    window.location.href = '/chat';
                } else {
                    Auth.loginAsGuest();
                }
            });
        }
        
        if (watchDemoBtn) {
            watchDemoBtn.addEventListener('click', () => {
                this.showDemo();
            });
        }
        
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                this.showContact();
            });
        }
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    },
    
    initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (10 + Math.random() * 10) + 's';
            container.appendChild(particle);
        }
    },
    
    initScrollEffects() {
        const header = document.getElementById('header');
        let lastScroll = 0;
        
        window.addEventListener('scroll', Utils.throttle(() => {
            const currentScroll = window.pageYOffset;
            
            if (header) {
                if (currentScroll > 50) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
            
            lastScroll = currentScroll;
        }, 100));
        
        // 双向滚动动效 - 使用 IntersectionObserver
        this.initBidirectionalScrollAnimations();
    },
    
    initBidirectionalScrollAnimations() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                
                if (entry.isIntersecting) {
                    // 元素进入视口 - 添加可见类
                    element.classList.add('visible');
                    
                    // 处理延迟动画
                    const delay = element.dataset.delay;
                    if (delay) {
                        element.style.transitionDelay = delay + 'ms';
                    }
                } else {
                    // 元素离开视口 - 移除可见类（实现双向动效）
                    element.classList.remove('visible');
                    element.style.transitionDelay = '0ms';
                }
            });
        }, observerOptions);
        
        // 观察所有需要动画的元素
        document.querySelectorAll('.scroll-animate').forEach(el => {
            observer.observe(el);
        });
        
        // 观察CTA区域
        const ctaTitle = document.querySelector('.cta-title');
        const ctaSubtitle = document.querySelector('.cta-subtitle');
        const ctaActions = document.querySelector('.cta-actions');
        
        if (ctaTitle) observer.observe(ctaTitle);
        if (ctaSubtitle) observer.observe(ctaSubtitle);
        if (ctaActions) observer.observe(ctaActions);
    },
    
    initAnimations() {
        // 添加CSS动画样式
        const style = document.createElement('style');
        style.textContent = `
            /* 滚动动画基础样式 */
            .scroll-animate {
                opacity: 0;
                transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .scroll-animate.visible {
                opacity: 1;
            }
            
            /* 淡入上移动画 */
            .scroll-animate[data-animate="fade-up"] {
                transform: translateY(30px);
            }
            
            .scroll-animate[data-animate="fade-up"].visible {
                transform: translateY(0);
            }
            
            /* 淡入左移动画 */
            .scroll-animate[data-animate="slide-left"] {
                transform: translateX(30px);
            }
            
            .scroll-animate[data-animate="slide-left"].visible {
                transform: translateX(0);
            }
            
            /* 缩放动画 */
            .scroll-animate[data-animate="scale"] {
                transform: scale(0.9);
            }
            
            .scroll-animate[data-animate="scale"].visible {
                transform: scale(1);
            }
            
            /* 标题高亮悬停效果 */
            .hero-title .highlight {
                position: relative;
                display: inline-block;
                cursor: pointer;
            }
            
            .hero-title .highlight::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: radial-gradient(circle, rgba(66, 133, 244, 0.3) 0%, transparent 70%);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: all 0.4s ease;
                z-index: -1;
            }
            
            .hero-title .highlight:hover::before {
                width: 150%;
                height: 150%;
            }
            
            /* 统计数据悬停效果 */
            .stat-item {
                transition: transform 0.3s ease;
            }
            
            .stat-item:hover {
                transform: translateY(-5px);
            }
            
            /* 按钮悬停光效 */
            .btn-primary {
                position: relative;
                overflow: hidden;
            }
            
            .btn-primary::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: width 0.6s ease, height 0.6s ease;
            }
            
            .btn-primary:hover::after {
                width: 300px;
                height: 300px;
            }
        `;
        document.head.appendChild(style);
        
        // 初始显示hero区域
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.style.opacity = '0';
            setTimeout(() => {
                heroContent.style.transition = 'opacity 0.8s ease';
                heroContent.style.opacity = '1';
            }, 100);
        }
    },
    
    showDemo() {
        alert('演示视频即将上线，敬请期待！');
    },
    
    showContact() {
        alert('联系方式：support@gyai.com');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await Auth.init();
    Landing.init();
});
