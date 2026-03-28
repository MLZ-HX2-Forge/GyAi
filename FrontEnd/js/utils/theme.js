const Theme = {
    themes: {
        dark: {
            name: '深色模式',
            icon: '🌙'
        },
        light: {
            name: '浅色模式',
            icon: '☀️'
        }
    },
    
    currentTheme: 'dark',
    initialized: false,
    
    init() {
        if (this.initialized) return;
        this.initialized = true;
        
        this.loadTheme();
        this.bindEvents();
        this.updateUI();
    },
    
    loadTheme() {
        const savedTheme = localStorage.getItem('gyai-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (!prefersDark) {
            this.currentTheme = 'light';
        }
        
        this.applyTheme(this.currentTheme);
    },
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('gyai-theme', theme);
        
        requestAnimationFrame(() => {
            this.updateUI();
        });
    },
    
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        
        if (typeof Chat !== 'undefined' && Chat.showToast) {
            Chat.showToast(`已切换到${this.themes[newTheme].name}`, 'success');
        }
    },
    
    setTheme(theme) {
        if (this.themes[theme]) {
            this.applyTheme(theme);
        }
    },
    
    getTheme() {
        return this.currentTheme;
    },
    
    updateUI() {
        const themeText = document.getElementById('themeText');
        const darkModeToggle = document.getElementById('darkModeToggle');
        
        if (themeText) {
            themeText.textContent = this.themes[this.currentTheme].name;
        }
        if (darkModeToggle) {
            darkModeToggle.checked = this.currentTheme === 'dark';
        }
    },
    
    bindEvents() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', (e) => {
                this.setTheme(e.target.checked ? 'dark' : 'light');
            });
        }
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('gyai-theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Theme.init());
} else {
    Theme.init();
}

window.Theme = Theme;
