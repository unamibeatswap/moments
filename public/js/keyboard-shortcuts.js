// Keyboard Shortcuts for Admin Dashboard

const shortcuts = {
    'Alt+D': () => window.dashboardCore.showSection('dashboard'),
    'Alt+M': () => window.dashboardCore.showSection('moments'),
    'Alt+C': () => window.dashboardCore.showSection('campaigns'),
    'Alt+S': () => window.dashboardCore.showSection('settings'),
    'Alt+H': () => window.dashboardCore.showSection('help'),
    'Alt+U': () => window.dashboardCore.showSection('users'),
    '?': () => toggleShortcutsHelp()
};

function toggleShortcutsHelp() {
    let overlay = document.getElementById('shortcuts-overlay');
    
    if (overlay) {
        overlay.remove();
        return;
    }
    
    overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    overlay.className = 'shortcuts-overlay';
    overlay.innerHTML = `
        <div class="shortcuts-modal">
            <div class="shortcuts-header">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <button class="close-btn" onclick="this.closest('.shortcuts-overlay').remove()" aria-label="Close shortcuts">&times;</button>
            </div>
            <div class="shortcuts-list">
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>D</kbd>
                    <span>Dashboard</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>M</kbd>
                    <span>Moments</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>C</kbd>
                    <span>Campaigns</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>S</kbd>
                    <span>Settings</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>H</kbd>
                    <span>Help</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Alt</kbd> + <kbd>U</kbd>
                    <span>Users</span>
                </div>
                <div class="shortcut-item">
                    <kbd>?</kbd>
                    <span>Show this help</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Esc</kbd>
                    <span>Close dialogs</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Listen for keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    if (e.target.matches('input, textarea, select')) return;
    
    const key = e.key;
    const combo = (e.altKey ? 'Alt+' : '') + key.toUpperCase();
    
    if (shortcuts[combo]) {
        e.preventDefault();
        shortcuts[combo]();
    } else if (key === '?') {
        e.preventDefault();
        shortcuts['?']();
    } else if (key === 'Escape') {
        // Close any open overlays
        document.querySelectorAll('.shortcuts-overlay, .hamburger-dropdown.active').forEach(el => {
            if (el.classList.contains('hamburger-dropdown')) {
                el.classList.remove('active');
            } else {
                el.remove();
            }
        });
    }
});

console.log('⌨️ Keyboard shortcuts enabled - Press ? for help');
