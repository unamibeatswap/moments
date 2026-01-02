const API_BASE = window.location.origin;
let currentPage = 1;
let allMoments = [];
let filteredMoments = [];
let confirmCallback = null;

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Load data for section
    switch(sectionId) {
        case 'dashboard': loadAnalytics(); loadRecentActivity(); break;
        case 'moments': loadMoments(); break;
        case 'sponsors': loadSponsors(); break;
        case 'broadcasts': loadBroadcasts(); break;
        case 'moderation': loadModeration(); break;
        case 'subscribers': loadSubscribers(); break;
        case 'settings': loadSettings(); break;
        case 'create': loadSponsors(); break;
    }
}

// Event listeners for navigation
document.addEventListener('DOMContentLoaded', () => {
    // Navigation buttons
    document.querySelectorAll('[data-section]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            showSection(e.target.dataset.section);
        });
    });

    // Filter selects
    document.querySelectorAll('[data-filter]').forEach(select => {
        select.addEventListener('change', filterMoments);
    });

    // Search box
    document.querySelector('[data-search]').addEventListener('input', filterMoments);

    // Action buttons
    document.querySelector('[data-action="create-moment"]')?.addEventListener('click', () => {
        showSection('create');
    });

    // Initialize app
    loadAnalytics();
    loadRecentActivity();
    loadSponsors();
    loadSettings();
    
    // Load and apply logo from settings
    fetch(`${API_BASE}/admin/settings`)
        .then(response => response.json())
        .then(data => {
            const logoSetting = data.settings?.find(s => s.setting_key === 'app_logo');
            if (logoSetting && logoSetting.setting_value) {
                updateHeaderLogo(logoSetting.setting_value);
            }
        })
        .catch(console.error);
});

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/admin/analytics`);
        const data = await response.json();
        
        document.getElementById('analytics').innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${data.totalMoments || 0}</div>
                <div class="stat-label">Total Moments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.activeSubscribers || 0}</div>
                <div class="stat-label">Active Subscribers</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.totalBroadcasts || 0}</div>
                <div class="stat-label">Broadcasts Sent</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.successRate || 0}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        `;
    } catch (error) {
        document.getElementById('analytics').innerHTML = '<div class="error">Failed to load analytics</div>';
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch(`${API_BASE}/admin/moments?limit=5`);
        const data = await response.json();
        
        if (data.moments && data.moments.length > 0) {
            const html = data.moments.map(moment => `
                <div style="padding: 0.75rem; border-left: 3px solid #2563eb; margin-bottom: 0.5rem; background: #f8fafc;">
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">${moment.title}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">
                        ${moment.region} • ${moment.category} • ${new Date(moment.created_at).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
            document.getElementById('recent-activity').innerHTML = html;
        } else {
            document.getElementById('recent-activity').innerHTML = '<div class="empty-state">No recent activity</div>';
        }
    } catch (error) {
        document.getElementById('recent-activity').innerHTML = '<div class="error">Failed to load recent activity</div>';
    }
}

// Load moments with filtering and pagination
async function loadMoments(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/admin/moments?page=${page}&limit=10`);
        const data = await response.json();
        allMoments = data.moments || [];
        currentPage = page;
        filterMoments();
    } catch (error) {
        document.getElementById('moments-list').innerHTML = '<div class="error">Failed to load moments</div>';
    }
}

function filterMoments() {
    const statusFilter = document.getElementById('status-filter').value;
    const regionFilter = document.getElementById('region-filter').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('search-box').value.toLowerCase();

    filteredMoments = allMoments.filter(moment => {
        const matchesStatus = !statusFilter || moment.status === statusFilter;
        const matchesRegion = !regionFilter || moment.region === regionFilter;
        const matchesCategory = !categoryFilter || moment.category === categoryFilter;
        const matchesSearch = !searchTerm || 
            moment.title.toLowerCase().includes(searchTerm) ||
            moment.content.toLowerCase().includes(searchTerm);
        
        return matchesStatus && matchesRegion && matchesCategory && matchesSearch;
    });

    displayMoments();
}

function displayMoments() {
    if (filteredMoments.length === 0) {
        document.getElementById('moments-list').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div>No moments found</div>
                <button class="btn" onclick="showSection('create')" style="margin-top: 1rem;">Create First Moment</button>
            </div>
        `;
        return;
    }

    const html = filteredMoments.map(moment => `
        <div class="moment-item">
            <div class="moment-header">
                <div class="moment-info">
                    <div class="moment-title">${moment.title}</div>
                    <div class="moment-meta">
                        ${moment.region} • ${moment.category} • ${new Date(moment.created_at).toLocaleDateString()}
                        ${moment.is_sponsored ? ` • Sponsored by ${moment.sponsors?.display_name || 'Unknown'}` : ''}
                    </div>
                </div>
                <div class="moment-actions">
                    <span class="status-badge status-${moment.status}">${moment.status}</span>
                    ${moment.status === 'draft' ? `<button class="btn btn-sm btn-success" data-broadcast="${moment.id}">Broadcast</button>` : ''}
                    ${moment.status !== 'broadcasted' ? `<button class="btn btn-sm" data-edit="${moment.id}">Edit</button>` : ''}
                    <button class="btn btn-sm btn-danger" data-delete="${moment.id}">Delete</button>
                </div>
            </div>
            <div class="moment-content">${moment.content.substring(0, 200)}${moment.content.length > 200 ? '...' : ''}</div>
            ${moment.scheduled_at ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem;">Scheduled: ${new Date(moment.scheduled_at).toLocaleString()}</div>` : ''}
        </div>
    `).join('');
    
    document.getElementById('moments-list').innerHTML = html;

    // Add event listeners for moment actions
    document.querySelectorAll('[data-broadcast]').forEach(btn => {
        btn.addEventListener('click', (e) => broadcastMoment(e.target.dataset.broadcast));
    });
    document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', (e) => editMoment(e.target.dataset.edit));
    });
    document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => deleteMoment(e.target.dataset.delete));
    });
}

// Load sponsors
async function loadSponsors() {
    try {
        const response = await fetch(`${API_BASE}/admin/sponsors`);
        const data = await response.json();
        
        // Update sponsor select in create form
        const sponsorSelect = document.getElementById('sponsor-select');
        if (sponsorSelect) {
            sponsorSelect.innerHTML = '<option value="">No Sponsor</option>' + 
                (data.sponsors || []).map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
        
        // Show sponsors list
        if (data.sponsors && data.sponsors.length > 0) {
            const html = data.sponsors.map(sponsor => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${sponsor.display_name}</div>
                            <div class="moment-meta">${sponsor.name} • ${sponsor.contact_email || 'No email'}</div>
                        </div>
                        <div class="moment-actions">
                            <button class="btn btn-sm" data-edit-sponsor="${sponsor.id}">Edit</button>
                            <button class="btn btn-sm btn-danger" data-delete-sponsor="${sponsor.id}">Delete</button>
                        </div>
                    </div>
                    ${sponsor.website_url ? `<div style="font-size: 0.875rem; color: #2563eb;"><a href="${sponsor.website_url}" target="_blank">${sponsor.website_url}</a></div>` : ''}
                </div>
            `).join('');
            document.getElementById('sponsors-list').innerHTML = html;

            // Add event listeners
            document.querySelectorAll('[data-edit-sponsor]').forEach(btn => {
                btn.addEventListener('click', (e) => editSponsor(e.target.dataset.editSponsor));
            });
            document.querySelectorAll('[data-delete-sponsor]').forEach(btn => {
                btn.addEventListener('click', (e) => deleteSponsor(e.target.dataset.deleteSponsor));
            });
        } else {
            document.getElementById('sponsors-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏢</div>
                    <div>No sponsors found</div>
                    <button class="btn" data-new-sponsor style="margin-top: 1rem;">Add First Sponsor</button>
                </div>
            `;
            document.querySelector('[data-new-sponsor]')?.addEventListener('click', openSponsorModal);
        }
    } catch (error) {
        document.getElementById('sponsors-list').innerHTML = '<div class="error">Failed to load sponsors</div>';
    }
}

// Load settings
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/admin/settings`);
        const data = await response.json();
        
        if (data.settings && data.settings.length > 0) {
            const html = data.settings.map(setting => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${setting.setting_key.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}</div>
                            <div class="moment-meta">${setting.description || 'No description'}</div>
                        </div>
                        <div class="moment-actions">
                            <button class="btn btn-sm" data-edit-setting="${setting.setting_key}" data-setting-value="${setting.setting_value}" data-setting-type="${setting.setting_type}">Edit</button>
                        </div>
                    </div>
                    <div class="moment-content">
                        ${setting.setting_type === 'url' && setting.setting_value.includes('.png') ? 
                            `<img src="${setting.setting_value}" alt="${setting.setting_key}" style="max-width: 100px; height: auto; border-radius: 4px;">` : 
                            setting.setting_value
                        }
                    </div>
                </div>
            `).join('');
            document.getElementById('settings-list').innerHTML = html;

            // Add event listeners for settings
            document.querySelectorAll('[data-edit-setting]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const key = e.target.dataset.editSetting;
                    const value = e.target.dataset.settingValue;
                    const type = e.target.dataset.settingType;
                    editSetting(key, value, type);
                });
            });
        }
    } catch (error) {
        document.getElementById('settings-list').innerHTML = '<div class="error">Failed to load settings</div>';
    }
}

// Placeholder functions for other features
function loadBroadcasts() { console.log('Load broadcasts'); }
function loadModeration() { console.log('Load moderation'); }
function loadSubscribers() { console.log('Load subscribers'); }
function editMoment(id) { console.log('Edit moment', id); }
function deleteMoment(id) { console.log('Delete moment', id); }
function broadcastMoment(id) { console.log('Broadcast moment', id); }
function editSponsor(id) { console.log('Edit sponsor', id); }
function deleteSponsor(id) { console.log('Delete sponsor', id); }
function openSponsorModal() { console.log('Open sponsor modal'); }
function editSetting(key, value, type) { 
    const newValue = prompt(`Edit ${key.replace(/_/g, ' ')}:`, value);
    if (newValue !== null && newValue !== value) {
        updateSetting(key, newValue);
    }
}

async function updateSetting(key, value) {
    try {
        const response = await fetch(`${API_BASE}/admin/settings/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        
        if (response.ok) {
            showSuccess('Setting updated successfully!');
            loadSettings();
            if (key === 'app_logo') {
                updateHeaderLogo(value);
            }
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to update setting');
        }
    } catch (error) {
        showError('Failed to update setting');
    }
}

function updateHeaderLogo(logoUrl) {
    const header = document.querySelector('.header h1');
    if (logoUrl && logoUrl.includes('.png')) {
        header.innerHTML = `<img src="${logoUrl}" alt="Logo" style="height: 2rem; vertical-align: middle; margin-right: 0.5rem;">Unami Foundation Moments`;
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `${type} notification`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1001;
        padding: 1rem;
        border-radius: 0.5rem;
        font-weight: 500;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('PWA: Service Worker registered', registration.scope);
        })
        .catch(error => {
            console.log('PWA: Service Worker registration failed', error);
        });
}