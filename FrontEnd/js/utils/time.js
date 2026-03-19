/**
 * 时间工具函数
 */

const TimeUtils = {
    format(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },
    
    relative(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) {
            return '刚刚';
        } else if (minutes < 60) {
            return `${minutes}分钟前`;
        } else if (hours < 24) {
            return `${hours}小时前`;
        } else if (days < 7) {
            return `${days}天前`;
        } else {
            return this.format(date, 'MM-DD HH:mm');
        }
    },
    
    now() {
        return new Date().toISOString();
    },
    
    timestamp() {
        return Date.now();
    }
};

const Utils = {
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },
    
    debounce(fn, delay = 300) {
        let timer = null;
        return function(...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },
    
    throttle(fn, delay = 300) {
        let last = 0;
        return function(...args) {
            const now = Date.now();
            if (now - last >= delay) {
                last = now;
                fn.apply(this, args);
            }
        };
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    truncate(text, length = 100) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },
    
    copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (e) {
                    reject(e);
                }
                document.body.removeChild(textarea);
            }
        });
    },
    
    formatMarkdown(text) {
        if (!text) return '';
        
        let html = text;
        
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block"><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');
        
        html = html.replace(/^- (.+)$/gm, '<li class="md-li">$1</li>');
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="md-li md-li-num">$2</li>');
        
        html = html.replace(/\n\n/g, '</p><p class="md-paragraph">');
        html = html.replace(/\n/g, '<br>');
        
        html = '<p class="md-paragraph">' + html + '</p>';
        
        html = html.replace(/<p class="md-paragraph"><\/p>/g, '');
        html = html.replace(/<p class="md-paragraph"><br>/g, '<p class="md-paragraph">');
        
        return html;
    },
    
    isMobile() {
        return window.innerWidth <= 768;
    },
    
    storage: {
        get(key) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : null;
            } catch {
                return null;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch {
                return false;
            }
        },
        
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch {
                return false;
            }
        }
    },
    
    cookie: {
        get(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        },
        
        set(name, value, days = 7) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
        },
        
        remove(name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
        }
    }
};

const ConfirmDialog = {
    show(options) {
        return new Promise((resolve) => {
            const {
                title = '确认操作',
                message = '确定要执行此操作吗？',
                confirmText = '确定',
                cancelText = '取消',
                type = 'warning',
                showWarning = false,
                warningText = ''
            } = options;
            
            const existingDialog = document.getElementById('confirmDialogOverlay');
            if (existingDialog) {
                existingDialog.remove();
            }
            
            const overlay = document.createElement('div');
            overlay.id = 'confirmDialogOverlay';
            overlay.className = 'confirm-dialog-overlay';
            
            let warningHTML = '';
            if (showWarning && warningText) {
                warningHTML = `<div class="confirm-warning"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${warningText}</span></div>`;
            }
            
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-dialog-header">
                        <span class="confirm-dialog-icon ${type}">${type === 'danger' ? '⚠️' : '💡'}</span>
                        <h3 class="confirm-dialog-title">${title}</h3>
                    </div>
                    <div class="confirm-dialog-body">
                        <p class="confirm-dialog-message">${message}</p>
                        ${warningHTML}
                    </div>
                    <div class="confirm-dialog-footer">
                        <button class="confirm-dialog-btn cancel" id="confirmCancel">${cancelText}</button>
                        <button class="confirm-dialog-btn confirm ${type}" id="confirmOk">${confirmText}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
            
            const closeDialog = (result) => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                }, 200);
                resolve(result);
            };
            
            document.getElementById('confirmCancel').addEventListener('click', () => closeDialog(false));
            document.getElementById('confirmOk').addEventListener('click', () => closeDialog(true));
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog(false);
                }
            });
            
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    closeDialog(false);
                }
            });
        });
    }
};
