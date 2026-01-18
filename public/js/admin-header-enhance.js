// Admin Header Enhancement - Holistic Implementation
// Adds: Hamburger menu, page context, semantic grouping

(function() {
    'use strict';
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderEnhancements);
    } else {
        initHeaderEnhancements();
    }
    
    function initHeaderEnhancements() {
        addPageContext();
        addHamburgerMenu();
        addSemanticGrouping();
        setupPageContextUpdates();
    }
    
    // STAGE 3: Add page context display
    function addPageContext() {
        const headerTop = document.querySelector('.admin-header-top');
        if (!headerTop || document.querySelector('.admin-page-context')) return;
        
        const pageContext = document.createElement('div');
        pageContext.className = 'admin-page-context';
        pageContext.id = 'admin-page-context';
        pageContext.textContent = 'Dashboard';
        
        // Insert after branding (or first child)
        const branding = headerTop.querySelector('.admin-branding') || headerTop.querySelector('.admin-user-controls');
        if (branding) {
            branding.parentNode.insertBefore(pageContext, branding.nextSibling);
        }
    }
    
    // STAGE 5: Add hamburger menu
    function addHamburgerMenu() {
        const userControls = document.querySelector('.admin-user-controls');
        if (!userControls || document.querySelector('.hamburger-btn')) return;
        
        // Get user info
        const userEmail = document.getElementById('user-email')?.textContent || 'Admin';
        const userRole = document.getElementById('user-role')?.textContent || 'Administrator';
        
        // Create hamburger button
        const hamburgerBtn = document.createElement('button');
        hamburgerBtn.className = 'hamburger-btn';
        hamburgerBtn.innerHTML = '☰';
        hamburgerBtn.setAttribute('aria-label', 'Menu');
        
        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'hamburger-dropdown';
        dropdown.innerHTML = `
            <div class="hamburger-user-info">
                <div class="hamburger-email">${userEmail}</div>
                <div class="hamburger-role">${userRole}</div>
            </div>
            <button class="hamburger-item" id="hamburger-sign-out">
                <span class="icon icon-sign-out"></span>
                Sign Out
            </button>
        `;
        
        // Insert before sign out button
        const signOutBtn = document.getElementById('sign-out');
        if (signOutBtn) {
            userControls.insertBefore(hamburgerBtn, signOutBtn);
            signOutBtn.style.display = 'none'; // Hide original sign out
        }
        
        // Append dropdown to header
        document.querySelector('.admin-header-container').appendChild(dropdown);
        
        // Toggle dropdown
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== hamburgerBtn) {
                dropdown.classList.remove('active');
            }
        });
        
        // Handle sign out from hamburger
        const hamburgerSignOut = document.getElementById('hamburger-sign-out');
        if (hamburgerSignOut && signOutBtn) {
            hamburgerSignOut.addEventListener('click', () => {
                signOutBtn.click(); // Trigger original sign out
            });
        }
    }
    
    // STAGE 4: Add semantic grouping to navigation
    function addSemanticGrouping() {
        const nav = document.querySelector('.admin-nav');
        if (!nav) return;
        
        // Define groups
        const groups = {
            monitor: ['dashboard', 'moments', 'campaigns'],
            community: ['sponsors', 'users', 'subscribers'],
            moderation: ['moderation', 'broadcasts'],
            system: ['settings', 'authority', 'budget-controls', 'help']
        };
        
        // Apply data-group attributes
        Object.entries(groups).forEach(([group, sections]) => {
            sections.forEach(section => {
                const btn = nav.querySelector(`[data-section="${section}"]`);
                if (btn) {
                    btn.setAttribute('data-group', group);
                }
            });
        });
        
        // Add separators between groups
        const navItems = Array.from(nav.querySelectorAll('.admin-nav-item'));
        let lastGroup = null;
        
        navItems.forEach((item, index) => {
            const currentGroup = item.getAttribute('data-group');
            if (lastGroup && currentGroup && lastGroup !== currentGroup) {
                const separator = document.createElement('span');
                separator.className = 'nav-separator';
                nav.insertBefore(separator, item);
            }
            lastGroup = currentGroup;
        });
    }
    
    // STAGE 3: Update page context on navigation
    function setupPageContextUpdates() {
        const pageContext = document.getElementById('admin-page-context');
        if (!pageContext) return;
        
        // Update on navigation click
        document.querySelectorAll('[data-section]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sectionName = btn.querySelector('span:not(.icon)')?.textContent || 
                                  btn.textContent.trim();
                pageContext.textContent = sectionName;
            });
        });
    }
    
})();
