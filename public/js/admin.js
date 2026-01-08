// Direct API calls without Supabase library
const API_BASE = '/admin';

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('admin.auth.token');
}

// API fetch with auth
async function apiFetch(path, opts = {}) {
    opts.headers = opts.headers || {};
    const token = getAuthToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const response = await fetch(url, opts);
    
    // Handle auth errors gracefully
    if (response.status === 401) {
        console.warn('Authentication failed, clearing tokens');
        localStorage.removeItem('admin.auth.token');
        localStorage.removeItem('admin.user.info');
        // Don't auto-redirect, let user stay on page
        throw new Error('Authentication expired');
    }
    
    return response;
}
let currentPage = 1;
let allMoments = [];
let filteredMoments = [];
let confirmCallback = null;

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    const navButton = document.querySelector(`[data-section="${sectionId}"]`);
    if (navButton) navButton.classList.add('active');
    
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

// Event delegation for all interactions
document.addEventListener('click', (e) => {
    const action = e.target.getAttribute('data-action');
    const section = e.target.getAttribute('data-section');
    const filter = e.target.getAttribute('data-filter');
    
    if (section) {
        showSection(section);
    } else if (action) {
        handleAction(action, e.target);
    }
});

document.addEventListener('change', (e) => {
    const filter = e.target.getAttribute('data-filter');
    if (filter === 'status' || filter === 'region' || filter === 'category') {
        filterMoments();
    } else if (filter === 'moderation') {
        loadModeration();
    } else if (filter === 'subscribers') {
        loadSubscribers();
    }
});

document.addEventListener('input', (e) => {
    const search = e.target.getAttribute('data-search');
    if (search === 'moments') {
        filterMoments();
    }
    if (e.target.name === 'content') {
        updateCharCount();
    }
});

function handleAction(action, element) {
    const id = element.getAttribute('data-id');
    const key = element.getAttribute('data-key');
    const value = element.getAttribute('data-value');
    const type = element.getAttribute('data-type');
    
    switch(action) {
        case 'create-moment':
            showSection('create');
            break;
        case 'back-to-moments':
            showSection('moments');
            break;
        case 'reset-form':
            resetForm();
            break;
        case 'new-sponsor':
            openSponsorModal();
            break;
        case 'close-sponsor-modal':
        case 'cancel-sponsor':
            closeSponsorModal();
            break;
        case 'close-confirm-modal':
        case 'cancel-confirm':
            closeConfirmModal();
            break;
        case 'confirm-action':
            confirmAction();
            break;
        case 'broadcast':
            broadcastMoment(id);
            break;
        case 'edit':
            editMoment(id);
            break;
        case 'delete':
            deleteMoment(id);
            break;
        case 'edit-sponsor':
            editSponsor(id);
            break;
        case 'delete-sponsor':
            deleteSponsor(id);
            break;
        case 'create-campaign':
            openCampaignModal();
            break;
        case 'close-campaign-modal':
        case 'cancel-campaign':
            closeCampaignModal();
            break;
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await apiFetch('/analytics');
        const data = await response.json();
        
        document.getElementById('analytics').innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${data.totalMoments || 0}</div>
                <div class="stat-label">Total Moments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.communityMoments || 0}</div>
                <div class="stat-label">Community Reports</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.adminMoments || 0}</div>
                <div class="stat-label">Official Updates</div>
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
        console.error('Analytics load error:', error);
        if (error.message === 'Authentication expired') {
            document.getElementById('analytics').innerHTML = '<div class="error">Session expired. Please <a href="/login">login again</a>.</div>';
        } else {
            document.getElementById('analytics').innerHTML = '<div class="error">Failed to load analytics</div>';
        }
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await apiFetch('/moments?limit=5');
        const data = await response.json();
        
        const recentActivityEl = document.getElementById('recent-activity');
        if (!recentActivityEl) return;
        
        if (data.moments && data.moments.length > 0) {
            const html = data.moments.map(moment => `
                <div style="padding: 0.75rem; border-left: 3px solid #2563eb; margin-bottom: 0.5rem; background: #f8fafc;">
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">${moment.title}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">
                        ${moment.region} • ${moment.category} • ${new Date(moment.created_at).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
            recentActivityEl.innerHTML = html;
        } else {
            recentActivityEl.innerHTML = '<div class="empty-state">No recent activity</div>';
        }
    } catch (error) {
        console.error('Recent activity load error:', error);
        const recentActivityEl = document.getElementById('recent-activity');
        if (recentActivityEl) {
            if (error.message === 'Authentication expired') {
                recentActivityEl.innerHTML = '<div class="error">Session expired. Please <a href="/login">login again</a>.</div>';
            } else {
                recentActivityEl.innerHTML = '<div class="error">Failed to load recent activity</div>';
            }
        }
    }
}

// Load moments with filtering and pagination
async function loadMoments(page = 1) {
    try {
        const response = await apiFetch(`/moments?page=${page}&limit=10`);
        const data = await response.json();
        allMoments = data.moments || [];
        currentPage = page;
        filterMoments();
    } catch (error) {
        document.getElementById('moments-list').innerHTML = '<div class="error">Failed to load moments</div>';
    }
}

function filterMoments() {
    const statusFilter = document.getElementById('status-filter')?.value || '';
    const regionFilter = document.getElementById('region-filter')?.value || '';
    const categoryFilter = document.getElementById('category-filter')?.value || '';
    const searchTerm = document.getElementById('search-box')?.value.toLowerCase() || '';

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
                <h3>No moments found</h3>
                <p>Create your first moment to share with the community</p>
                <button class="btn" data-section="create" style="margin-top: 1rem;">✏️ Create First Moment</button>
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
                    ${moment.status === 'draft' ? `<button class="btn btn-sm btn-success" data-action="broadcast" data-id="${moment.id}">📡 Broadcast Now</button>` : ''}
                    ${moment.status !== 'broadcasted' ? `<button class="btn btn-sm" data-action="edit" data-id="${moment.id}">✏️ Edit</button>` : ''}
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${moment.id}">🗑️ Delete</button>
                </div>
            </div>
            <div class="moment-content">${moment.content.substring(0, 200)}${moment.content.length > 200 ? '...' : ''}</div>
            ${moment.scheduled_at ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem;">Scheduled: ${new Date(moment.scheduled_at).toLocaleString()}</div>` : ''}
        </div>
    `).join('');
    
    document.getElementById('moments-list').innerHTML = html;
}

// Edit moment
async function editMoment(id) {
    const moment = allMoments.find(m => m.id === id);
    if (!moment) return;

    // Populate form
    document.getElementById('edit-id').value = id;
    document.querySelector('[name="title"]').value = moment.title;
    document.querySelector('[name="content"]').value = moment.content;
    document.querySelector('[name="region"]').value = moment.region;
    document.querySelector('[name="category"]').value = moment.category;
    document.querySelector('[name="sponsor_id"]').value = moment.sponsor_id || '';
    document.querySelector('[name="pwa_link"]').value = moment.pwa_link || '';
    if (moment.scheduled_at) {
        const date = new Date(moment.scheduled_at);
        document.querySelector('[name="scheduled_at"]').value = date.toISOString().slice(0, 16);
    }

    // Update UI
    document.getElementById('create-title').textContent = 'Edit Moment';
    document.getElementById('submit-btn').textContent = 'Update Moment';
    updateCharCount();
    showSection('create');
}

// Delete moment
function deleteMoment(id) {
    const moment = allMoments.find(m => m.id === id);
    showConfirm(`Delete "${moment.title}"?`, async () => {
        try {
                const response = await apiFetch(`/moments/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Moment deleted successfully');
                loadMoments(currentPage);
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to delete moment');
            }
        } catch (error) {
            showError('Failed to delete moment');
        }
    });
}

// Broadcast moment
async function broadcastMoment(momentId) {
    showConfirm('Broadcast this moment now?', async () => {
        const broadcastBtn = document.querySelector(`[data-action="broadcast"][data-id="${momentId}"]`);
        if (broadcastBtn) setButtonLoading(broadcastBtn, true);
        
        try {
            const response = await apiFetch(`/moments/${momentId}/broadcast`, {
                method: 'POST'
            });
            
            const result = await response.json();
            if (response.ok) {
                showSuccess('Moment broadcasted successfully!');
                loadMoments(currentPage);
                loadAnalytics();
            } else {
                showError(result.error || 'Failed to broadcast moment');
            }
        } catch (error) {
            showError('Failed to broadcast moment');
        } finally {
            if (broadcastBtn) setButtonLoading(broadcastBtn, false);
        }
    });
}

// Load sponsors
async function loadSponsors() {
    try {
        const response = await apiFetch('/sponsors');
        const data = await response.json();
        
        // Update sponsor select in create form
        const sponsorSelect = document.getElementById('sponsor-select');
        if (sponsorSelect) {
            sponsorSelect.innerHTML = '<option value="">No Sponsor</option>' + 
                (data.sponsors || []).map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
        
        // Show sponsors list
        const sponsorsList = document.getElementById('sponsors-list');
        if (sponsorsList) {
            if (data.sponsors && data.sponsors.length > 0) {
                const html = data.sponsors.map(sponsor => `
                    <div class="moment-item">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">${sponsor.display_name}</div>
                                <div class="moment-meta">${sponsor.name} • ${sponsor.contact_email || 'No email'}</div>
                            </div>
                            <div class="moment-actions">
                                <button class="btn btn-sm" data-action="edit-sponsor" data-id="${sponsor.id}">Edit</button>
                                <button class="btn btn-sm btn-danger" data-action="delete-sponsor" data-id="${sponsor.id}">Delete</button>
                            </div>
                        </div>
                        ${sponsor.website_url ? `<div style="font-size: 0.875rem; color: #2563eb;"><a href="${sponsor.website_url}" target="_blank">${sponsor.website_url}</a></div>` : ''}
                    </div>
                `).join('');
                sponsorsList.innerHTML = html;
            } else {
                sponsorsList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏢</div>
                        <div>No sponsors found</div>
                        <button class="btn" data-action="new-sponsor" style="margin-top: 1rem;">Add First Sponsor</button>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Sponsors load error:', error);
        const sponsorsList = document.getElementById('sponsors-list');
        if (sponsorsList) {
            if (error.message === 'Authentication expired') {
                sponsorsList.innerHTML = '<div class="error">Session expired. Please <a href="/login">login again</a>.</div>';
            } else {
                sponsorsList.innerHTML = '<div class="error">Failed to load sponsors</div>';
            }
        }
    }
}

// Sponsor modal functions
function openSponsorModal(id = null) {
    if (id) {
        document.getElementById('sponsor-modal-title').textContent = 'Edit Sponsor';
        document.getElementById('sponsor-submit-btn').textContent = 'Update Sponsor';
    } else {
        document.getElementById('sponsor-form').reset();
        document.getElementById('sponsor-modal-title').textContent = 'Create Sponsor';
        document.getElementById('sponsor-submit-btn').textContent = 'Create Sponsor';
    }
    document.getElementById('sponsor-modal').classList.add('active');
}

function closeSponsorModal() {
    document.getElementById('sponsor-modal').classList.remove('active');
    document.getElementById('sponsor-form').reset();
    document.getElementById('sponsor-message').innerHTML = '';
}

function editSponsor(id) {
    openSponsorModal(id);
}

function deleteSponsor(id) {
    showConfirm('Delete this sponsor?', async () => {
        try {
            const response = await apiFetch(`/admin/sponsors/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Sponsor deleted successfully');
                loadSponsors();
            } else {
                showError('Failed to delete sponsor');
            }
        } catch (error) {
            showError('Failed to delete sponsor');
        }
    });
}

// Load broadcasts
async function loadBroadcasts() {
    try {
        const response = await apiFetch('/admin/broadcasts');
        const data = await response.json();
        
        if (data.broadcasts && data.broadcasts.length > 0) {
            const html = data.broadcasts.map(broadcast => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">Broadcast #${broadcast.id.slice(0, 8)}</div>
                            <div class="moment-meta">
                                ${new Date(broadcast.broadcast_started_at).toLocaleString()}
                                ${broadcast.broadcast_completed_at ? ` - ${new Date(broadcast.broadcast_completed_at).toLocaleString()}` : ''}
                            </div>
                        </div>
                        <div class="moment-actions">
                            <span class="status-badge status-${broadcast.status}">${broadcast.status}</span>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
                        <div><strong>${broadcast.recipient_count}</strong><br><small>Recipients</small></div>
                        <div><strong>${broadcast.success_count}</strong><br><small>Success</small></div>
                        <div><strong>${broadcast.failure_count}</strong><br><small>Failed</small></div>
                        <div><strong>${broadcast.recipient_count > 0 ? Math.round(broadcast.success_count / broadcast.recipient_count * 100) : 0}%</strong><br><small>Success Rate</small></div>
                    </div>
                </div>
            `).join('');
            document.getElementById('broadcasts-list').innerHTML = html;
        } else {
            document.getElementById('broadcasts-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📡</div>
                    <div>No broadcasts yet</div>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('broadcasts-list').innerHTML = '<div class="error">Failed to load broadcasts</div>';
    }
}

// Load moderation queue
async function loadModeration() {
    try {
        const filter = document.getElementById('moderation-filter')?.value || 'all';
        const response = await apiFetch(`/admin/moderation?filter=${filter}`);
        const data = await response.json();
        
        if (data.flaggedMessages && data.flaggedMessages.length > 0) {
            const html = data.flaggedMessages.map(msg => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">Message from ${msg.from_number.replace(/\d(?=\d{4})/g, '*')}</div>
                            <div class="moment-meta">${new Date(msg.created_at).toLocaleString()}</div>
                        </div>
                        <div class="moment-actions">
                            <button class="btn btn-sm btn-success">Approve</button>
                            <button class="btn btn-sm btn-danger">Flag</button>
                        </div>
                    </div>
                    <div class="moment-content">${msg.content}</div>
                    <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #dc2626;">
                        Flagged: ${msg.advisories?.map(a => `${a.advisory_type} (${Math.round(a.confidence * 100)}%)`).join(', ')}
                    </div>
                </div>
            `).join('');
            document.getElementById('moderation-list').innerHTML = html;
        } else {
            document.getElementById('moderation-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div>No flagged content</div>
                    <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">All content is clean!</div>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('moderation-list').innerHTML = '<div class="error">Failed to load moderation queue</div>';
    }
}

// Load subscribers
async function loadSubscribers() {
    try {
        const filter = document.getElementById('subscriber-filter')?.value || 'all';
        const response = await apiFetch(`/admin/subscribers?filter=${filter}`);
        const data = await response.json();
        
        if (data.subscribers && data.subscribers.length > 0) {
            const html = data.subscribers.map(sub => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${sub.phone_number.replace(/\d(?=\d{4})/g, '*')}</div>
                            <div class="moment-meta">
                                Joined: ${new Date(sub.opted_in_at).toLocaleDateString()}
                                • Last active: ${new Date(sub.last_activity).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="moment-actions">
                            <span class="status-badge ${sub.opted_in ? 'status-broadcasted' : 'status-cancelled'}">
                                ${sub.opted_in ? 'Active' : 'Opted Out'}
                            </span>
                        </div>
                    </div>
                    <div style="font-size: 0.875rem; color: #6b7280;">
                        Regions: ${sub.regions?.join(', ') || 'All'} • 
                        Categories: ${sub.categories?.join(', ') || 'All'}
                    </div>
                </div>
            `).join('');
            document.getElementById('subscribers-list').innerHTML = html;
        } else {
            document.getElementById('subscribers-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📱</div>
                    <div>No subscribers found</div>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('subscribers-list').innerHTML = '<div class="error">Failed to load subscribers</div>';
    }
}

// Load system settings
async function loadSettings() {
    try {
        const response = await apiFetch('/admin/settings');
        const data = await response.json();
        
        if (data.settings && data.settings.length > 0) {
            const html = data.settings.map(setting => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                            <div class="moment-meta">${setting.description || 'No description'}</div>
                        </div>
                        <div class="moment-actions">
                            <button class="btn btn-sm" data-action="edit-setting" data-key="${setting.setting_key}" data-value="${setting.setting_value}" data-type="${setting.setting_type}">Edit</button>
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
        } else {
            document.getElementById('settings-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚙️</div>
                    <div>No settings found</div>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('settings-list').innerHTML = '<div class="error">Failed to load settings</div>';
    }
}

// Edit setting
function editSetting(key, currentValue, type) {
    const newValue = prompt(`Edit ${key.replace(/_/g, ' ')}:`, currentValue);
    if (newValue !== null && newValue !== currentValue) {
        updateSetting(key, newValue);
    }
}

// Update setting
async function updateSetting(key, value) {
    try {
        const response = await apiFetch(`/settings/${key}`, {
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

// Update header logo
function updateHeaderLogo(logoUrl) {
    const header = document.querySelector('.header h1');
    if (logoUrl && logoUrl.includes('.png')) {
        header.innerHTML = `<img src="${logoUrl}" alt="Logo" style="height: 2rem; vertical-align: middle; margin-right: 0.5rem;">Unami Foundation Moments`;
    }
}

// Form handling
function resetForm() {
    document.getElementById('create-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('create-title').textContent = 'Create New Moment';
    document.getElementById('submit-btn').textContent = 'Create Moment';
    document.getElementById('create-message').innerHTML = '';
    updateCharCount();
}

function updateCharCount() {
    const content = document.querySelector('[name="content"]');
    const charCount = document.getElementById('char-count');
    if (content && charCount) {
        charCount.textContent = content.value.length;
    }
}

// Modal functions
function showConfirm(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    confirmCallback = null;
}

function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
        closeConfirmModal();
    }
}

// Notification functions
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

// Show loading state on button
function setButtonLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;"></span>Loading...';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
    }
}

// Add spinner CSS
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
document.head.appendChild(spinnerStyle);

// Form submission handlers
document.addEventListener('DOMContentLoaded', () => {
    // Create form handler
    const createForm = document.getElementById('create-form');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-btn');
            setButtonLoading(submitBtn, true);

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;

            data.is_sponsored = !!data.sponsor_id;

            // Normalize empty values
            Object.keys(data).forEach(key => {
                if (data[key] === '') delete data[key];
            });

            // Convert scheduled_at (datetime-local) to ISO if present
            if (data.scheduled_at && data.scheduled_at.indexOf('T') !== -1) {
                data.scheduled_at = new Date(data.scheduled_at).toISOString();
            }

            try {
                const url = isEdit ? `/moments/${data.id}` : '/moments';
                const method = isEdit ? 'PUT' : 'POST';

                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (response.ok) {
                    showSuccess(`Moment ${isEdit ? 'updated' : 'created'} successfully!`);
                    resetForm();
                    loadMoments();
                } else {
                    showError(result.error || `Failed to ${isEdit ? 'update' : 'create'} moment`);
                }
            } catch (error) {
                showError(`Failed to ${isEdit ? 'update' : 'create'} moment`);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Sponsor form handler
    const sponsorForm = document.getElementById('sponsor-form');
    if (sponsorForm) {
        sponsorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('sponsor-submit-btn');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;
            
            try {
                const url = isEdit ? `/sponsors/${data.id}` : '/sponsors';
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSuccess(`Sponsor ${isEdit ? 'updated' : 'created'} successfully!`);
                    closeSponsorModal();
                    loadSponsors();
                } else {
                    document.getElementById('sponsor-message').innerHTML = `<div class="error">${result.error}</div>`;
                }
            } catch (error) {
                document.getElementById('sponsor-message').innerHTML = '<div class="error">Failed to save sponsor</div>';
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Campaign form handler
    const campaignForm = document.getElementById('campaign-form');
    if (campaignForm) {
        campaignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('campaign-submit-btn');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Handle checkboxes for regions and categories
            const regions = Array.from(document.querySelectorAll('input[name="target_regions"]:checked')).map(cb => cb.value);
            const categories = Array.from(document.querySelectorAll('input[name="target_categories"]:checked')).map(cb => cb.value);
            
            data.target_regions = regions;
            data.target_categories = categories;
            
            try {
                const response = await apiFetch('/campaigns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSuccess('Campaign created successfully!');
                    closeCampaignModal();
                    loadCampaigns();
                } else {
                    showError(result.error || 'Failed to create campaign');
                }
            } catch (error) {
                showError('Failed to create campaign');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('PWA: Service Worker registered');
            })
            .catch(error => {
                console.log('PWA: Service Worker registration failed');
            });
    });
}

// Service Worker disabled to prevent session conflicts
// if ('serviceWorker' in navigator) {
//     navigator.serviceWorker.register('/sw.js')
//         .then(registration => {
//             console.log('PWA: Service Worker registered', registration.scope);
//         })
//         .catch(error => {
//             console.log('PWA: Service Worker registration failed', error);
//         });
// }

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA: Install prompt available');
    
    const installBtn = document.createElement('button');
    installBtn.textContent = '📱 Install App';
    installBtn.className = 'btn btn-sm';
    installBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000;';
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            console.log('PWA: Install result', result);
            deferredPrompt = null;
            installBtn.remove();
        }
    });
    document.body.appendChild(installBtn);
});

// Load campaigns
async function loadCampaigns() {
    try {
        const response = await apiFetch('/campaigns');
        const data = await response.json();
        
        if (data.campaigns && data.campaigns.length > 0) {
            const html = data.campaigns.map(campaign => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${campaign.title}</div>
                            <div class="moment-meta">
                                Budget: R${campaign.budget || 0} • ${new Date(campaign.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="moment-actions">
                            <span class="status-badge status-${campaign.status}">${campaign.status}</span>
                            ${campaign.status === 'pending_review' ? `<button class="btn btn-sm btn-success" data-action="approve-campaign" data-id="${campaign.id}">Approve</button>` : ''}
                            ${campaign.status === 'approved' ? `<button class="btn btn-sm btn-success" data-action="publish-campaign" data-id="${campaign.id}">Publish</button>` : ''}
                            <button class="btn btn-sm" data-action="edit-campaign" data-id="${campaign.id}">Edit</button>
                        </div>
                    </div>
                    <div class="moment-content">${campaign.content.substring(0, 200)}${campaign.content.length > 200 ? '...' : ''}</div>
                    <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem;">
                        Regions: ${campaign.target_regions?.join(', ') || 'All'} • 
                        Categories: ${campaign.target_categories?.join(', ') || 'All'}
                    </div>
                </div>
            `).join('');
            document.getElementById('campaigns-list').innerHTML = html;
        } else {
            document.getElementById('campaigns-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📢</div>
                    <div>No campaigns found</div>
                    <button class="btn" data-action="create-campaign" style="margin-top: 1rem;">Create First Campaign</button>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('campaigns-list').innerHTML = '<div class="error">Failed to load campaigns</div>';
    }
}

// Campaign modal functions
function openCampaignModal() {
    document.getElementById('campaign-modal').classList.add('active');
    document.getElementById('campaign-form').reset();
}

function closeCampaignModal() {
    document.getElementById('campaign-modal').classList.remove('active');
    document.getElementById('campaign-form').reset();
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', () => {
    // Create form handler
    const createForm = document.getElementById('create-form');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-btn');
            setButtonLoading(submitBtn, true);

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;

            data.is_sponsored = !!data.sponsor_id;

            Object.keys(data).forEach(key => {
                if (data[key] === '') delete data[key];
            });

            if (data.scheduled_at && data.scheduled_at.indexOf('T') !== -1) {
                data.scheduled_at = new Date(data.scheduled_at).toISOString();
            }

            try {
                const url = isEdit ? `/moments/${data.id}` : '/moments';
                const method = isEdit ? 'PUT' : 'POST';

                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (response.ok) {
                    showSuccess(`Moment ${isEdit ? 'updated' : 'created'} successfully!`);
                    resetForm();
                    loadMoments();
                } else {
                    showError(result.error || `Failed to ${isEdit ? 'update' : 'create'} moment`);
                }
            } catch (error) {
                showError(`Failed to ${isEdit ? 'update' : 'create'} moment`);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Sponsor form handler
    const sponsorForm = document.getElementById('sponsor-form');
    if (sponsorForm) {
        sponsorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('sponsor-submit-btn');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;
            
            try {
                const url = isEdit ? `/sponsors/${data.id}` : '/sponsors';
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSuccess(`Sponsor ${isEdit ? 'updated' : 'created'} successfully!`);
                    closeSponsorModal();
                    loadSponsors();
                } else {
                    document.getElementById('sponsor-message').innerHTML = `<div class="error">${result.error}</div>`;
                }
            } catch (error) {
                document.getElementById('sponsor-message').innerHTML = '<div class="error">Failed to save sponsor</div>';
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
});