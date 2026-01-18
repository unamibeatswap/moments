// Dark Mode Toggle

const darkMode = {
    init() {
        // Check saved preference or system preference
        const saved = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (saved === 'true' || (saved === null && prefersDark)) {
            this.enable();
        }
        
        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (localStorage.getItem('darkMode') === null) {
                e.matches ? this.enable() : this.disable();
            }
        });
        
        console.log('🌙 Dark mode initialized');
    },
    
    enable() {
        document.documentElement.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
        this.updateToggle(true);
    },
    
    disable() {
        document.documentElement.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
        this.updateToggle(false);
    },
    
    toggle() {
        if (document.documentElement.classList.contains('dark-mode')) {
            this.disable();
        } else {
            this.enable();
        }
    },
    
    updateToggle(isDark) {
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
            toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => darkMode.init());

// Export for use
window.darkMode = darkMode;
