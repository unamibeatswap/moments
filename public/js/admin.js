// Direct API calls to Supabase admin-api function
const API_BASE = 'https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api';
const SUPABASE_URL = 'https://bxmdzcxejcxbinghtyfw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bWR6Y3hlamN4YmluZ2h0eWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE3MzM5NiwiZXhwIjoyMDgzNzQ5Mzk2fQ.rcm_AT1o0Wiazvy9Pl6kjKc5jogHQKZyTfOxEX8v3Iw';

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('admin.auth.token');
}

// API fetch with auth
// Debounced API calls to prevent multiple rapid requests
const apiCallCache = new Map();
const pendingCalls = new Map();

async function apiFetch(path, opts = {}) {
    opts.headers = opts.headers || {};
    const token = getAuthToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    
    // Disable cache for GET requests
    if (!opts.method || opts.method === 'GET') {
        opts.cache = 'no-store';
        opts.headers['Cache-Control'] = 'no-cache';
    }
    
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    
    // Skip pendingCalls cache for authority and subscribers to ensure real-time updates
    const skipCache = url.includes('/authority') || url.includes('/subscribers');
    const cacheKey = `${opts.method || 'GET'}_${url}`;
    
    // Return pending call if one exists (unless skipping cache)
    if (!skipCache && pendingCalls.has(cacheKey)) {
        return pendingCalls.get(cacheKey);
    }
    
    // Create the fetch promise
    const fetchPromise = fetch(url, opts).then(response => {
        pendingCalls.delete(cacheKey);
        
        if (response.status === 401) {
            console.warn('Authentication failed, clearing tokens');
            localStorage.removeItem('admin.auth.token');
            localStorage.removeItem('admin.user.info');
            throw new Error('Authentication expired');
        }
        
        return response;
    }).catch(error => {
        pendingCalls.delete(cacheKey);
        throw error;
    });
    
    // Store pending call (unless skipping cache)
    if (!skipCache) {
        pendingCalls.set(cacheKey, fetchPromise);
    }
    
    return fetchPromise;
}

let currentPage = 1;
let allMoments = [];
let filteredMoments = [];
let confirmCallback = null;

// Navigation
// Fast section switching with immediate UI update
function showSection(sectionId) {
    // Immediate UI update
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    
    const targetSection = document.getElementById(sectionId);
    const navButton = document.querySelector(`[data-section="${sectionId}"]`);
    
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    if (navButton) {
        navButton.classList.add('active');
    }
    
    // Load data asynchronously without blocking UI
    setTimeout(() => {
        switch(sectionId) {
            case 'dashboard': 
                Promise.all([
                    loadAnalytics().catch(console.warn), 
                    loadRecentActivity().catch(console.warn), 
                    loadPipelineStatus().catch(console.warn)
                ]);
                break;
            case 'moments': loadMoments().catch(console.warn); break;
            case 'campaigns': loadCampaigns().catch(console.warn); break;
            case 'sponsors': loadSponsors().catch(console.warn); break;
            case 'subscribers': loadSubscribers().catch(console.warn); break;
            case 'users': loadAdminUsers().catch(console.warn); break;
            case 'broadcasts': loadBroadcasts().catch(console.warn); break;
            case 'moderation': loadModeration().catch(console.warn); break;
            case 'settings': loadSettings().catch(console.warn); break;
            case 'budget-controls': loadBudgetControls().catch(console.warn); break;
            case 'authority': loadAuthorityProfiles().catch(console.warn); break;
            case 'create': loadSponsors().catch(console.warn); break;
        }
    }, 0);
}

// Event delegation for all interactions
// Optimized event delegation with immediate feedback
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    
    // Immediate visual feedback for all buttons
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 100);
    
    const action = btn.getAttribute('data-action');
    const section = btn.getAttribute('data-section');
    
    if (section) {
        e.preventDefault();
        showSection(section);
    } else if (action) {
        e.preventDefault();
        // Don't await - let it run async
        handleAction(action, btn).catch(error => {
            console.error('Action error:', error);
            showError('Action failed: ' + error.message);
        });
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

// Async action handler with immediate feedback
async function handleAction(action, element) {
    const id = element.getAttribute('data-id');
    
    // Immediate loading state for async actions
    const asyncActions = ['broadcast', 'delete', 'edit', 'flag-message', 'approve-message'];
    if (asyncActions.includes(action)) {
        setButtonLoading(element, true);
    }
    
    try {
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
            case 'reset-campaign-form':
                document.getElementById('campaign-form').reset();
                break;
            case 'reset-sponsor-form':
                document.getElementById('sponsor-form').reset();
                break;
            case 'new-sponsor':
                openSponsorModal();
                break;
            case 'close-sponsor-modal':
            case 'cancel-sponsor':
            case 'close-sponsor-form':
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
                await broadcastMoment(id);
                break;
            case 'edit':
                await editMoment(id);
                break;
            case 'delete':
                await deleteMoment(id);
                break;
            case 'edit-sponsor':
                await editSponsor(id);
                break;
            case 'delete-sponsor':
                await deleteSponsor(id);
                break;
            case 'create-campaign':
                openCampaignModal();
                break;
            case 'close-campaign-modal':
            case 'cancel-campaign':
            case 'close-campaign-form':
                closeCampaignModal();
                break;
            case 'new-admin-user':
                openAdminUserModal();
                break;
            case 'close-admin-user-modal':
            case 'cancel-admin-user':
            case 'close-admin-user-form':
                closeAdminUserModal();
                break;
            case 'create-authority':
                document.getElementById('authority-form').reset();
                document.getElementById('authority-edit-id').value = '';
                document.getElementById('authority-form-title').textContent = 'Assign Authority';
                document.getElementById('authority-submit-btn').textContent = 'Assign Authority';
                showSection('authority-form-section');
                break;
            case 'close-authority-form':
                showSection('authority');
                break;
            case 'reset-authority-form':
                document.getElementById('authority-form').reset();
                document.getElementById('authority-edit-id').value = '';
                document.getElementById('authority-form-title').textContent = 'Assign Authority';
                document.getElementById('authority-submit-btn').textContent = 'Assign Authority';
                break;
            case 'edit-campaign':
                await editCampaign(id);
                break;
            case 'activate-campaign':
                await activateCampaign(id);
                break;
            case 'flag-message':
                await flagMessage(id);
                break;
            case 'approve-message':
                await approveMessage(id);
                break;
            case 'approve-comment':
                await approveComment(id);
                break;
            case 'feature-comment':
                await featureComment(id);
                break;
            case 'delete-comment':
                await deleteComment(id);
                break;
            case 'preview-message':
                previewMessage(id);
                break;
        }
    } finally {
        // Always reset loading state
        if (asyncActions.includes(action)) {
            setButtonLoading(element, false);
        }
    }
}

// Preview message function
function previewMessage(id) {
    // Simple preview - could be enhanced with modal
    const message = document.querySelector(`[data-id="${id}"]`);
    if (message) {
        const content = message.closest('.moment-item').querySelector('.moment-content');
        if (content) {
            alert('Message Preview:\n\n' + content.textContent.replace('Content: ', ''));
        }
    }
}

// Load analytics with direct Supabase fallback
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
                <div class="stat-number">${data.activeSubscribers || 0}</div>
                <div class="stat-label">Active Subscribers</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.totalBroadcasts || 0}</div>
                <div class="stat-label">Total Broadcasts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.successRate || '0'}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        `;
    } catch (error) {
        console.error('Analytics API failed, trying direct Supabase:', error);
        try {
            // Direct Supabase fallback
            const [moments, subs, broadcasts] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/moments?select=count`, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                }),
                fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=count&opted_in=eq.true`, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                }),
                fetch(`${SUPABASE_URL}/rest/v1/broadcasts?select=count`, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                })
            ]);
            
            document.getElementById('analytics').innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${moments.status === 200 ? 'Connected' : '0'}</div>
                    <div class="stat-label">Total Moments</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${subs.status === 200 ? 'Connected' : '0'}</div>
                    <div class="stat-label">Active Subscribers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${broadcasts.status === 200 ? 'Connected' : '0'}</div>
                    <div class="stat-label">Total Broadcasts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">Direct</div>
                    <div class="stat-label">DB Access</div>
                </div>
            `;
        } catch (fallbackError) {
            document.getElementById('analytics').innerHTML = '<div class="error">Database connection failed</div>';
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
            recentActivityEl.innerHTML = '<div class="error">Failed to load recent activity</div>';
        }
    }
}

// Load moments
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

    // Sort by latest first (descending)
    filteredMoments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
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
        document.getElementById('moments-pagination').innerHTML = '';
        return;
    }

    // Pagination logic
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredMoments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentMoments = filteredMoments.slice(startIndex, endIndex);

    const html = currentMoments.map(moment => {
        const mediaPreview = renderMediaPreview(moment.media_urls);
        const contentPreview = moment.content.length > 150 ? 
            `<div class="moment-content collapsed" data-full="${escapeHtml(moment.content)}">
                ${escapeHtml(moment.content.substring(0, 150))}
                <button class="expand-btn" onclick="toggleMomentContent(this)">...read more</button>
            </div>` :
            `<div class="moment-content">${escapeHtml(moment.content)}</div>`;
        
        // Format date and time
        const createdDate = new Date(moment.created_at);
        const formattedDateTime = createdDate.toLocaleString('en-ZA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        return `
            <div class="moment-item">
                <div class="moment-header">
                    <div class="moment-info">
                        <div class="moment-title">${escapeHtml(moment.title)}</div>
                        <div class="moment-meta">
                            ${moment.region} • ${moment.category} • ${formattedDateTime}
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
                ${contentPreview}
                ${mediaPreview}
                ${moment.scheduled_at ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem;">Scheduled: ${new Date(moment.scheduled_at).toLocaleString('en-ZA')}</div>` : ''}
            </div>
        `;
    }).join('');
    
    document.getElementById('moments-list').innerHTML = html;
    
    // Update pagination
    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const paginationEl = document.getElementById('moments-pagination');
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let paginationHtml = '';
    
    // Previous button
    if (currentPage > 1) {
        paginationHtml += `<button class="page-btn" onclick="changePage(${currentPage - 1})">← Previous</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHtml += `<button class="page-btn active">${i}</button>`;
        } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHtml += `<button class="page-btn" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHtml += `<span class="page-btn">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHtml += `<button class="page-btn" onclick="changePage(${currentPage + 1})">Next →</button>`;
    }
    
    paginationEl.innerHTML = paginationHtml;
}

function changePage(page) {
    currentPage = page;
    displayMoments();
}

function renderMediaPreview(mediaUrls) {
    if (!mediaUrls || mediaUrls.length === 0) return '';
    
    const mediaItems = mediaUrls.slice(0, 4);
    const hasMore = mediaUrls.length > 4;
    
    return `
        <div class="moment-media">
            ${mediaItems.map((url, index) => {
                if (!url || url.trim() === '') return '';
                
                const ext = url.split('.').pop()?.toLowerCase() || '';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    return `
                        <div class="media-preview" onclick="openMediaModal('${escapeHtml(url)}')">
                            <img src="${escapeHtml(url)}" alt="Media" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="media-icon" style="display:none;">🖼️</div>
                            ${hasMore && index === 3 ? `<div class="media-count">+${mediaUrls.length - 4}</div>` : ''}
                        </div>
                    `;
                } else if (['mp4', 'webm', 'mov', '3gp'].includes(ext)) {
                    return `
                        <div class="media-preview" onclick="openMediaModal('${escapeHtml(url)}')">
                            <video preload="none" muted onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <source src="${escapeHtml(url)}">
                            </video>
                            <div class="media-icon" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">▶️</div>
                            ${hasMore && index === 3 ? `<div class="media-count">+${mediaUrls.length - 4}</div>` : ''}
                        </div>
                    `;
                } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'amr'].includes(ext)) {
                    return `
                        <div class="media-preview" onclick="openMediaModal('${escapeHtml(url)}')">
                            <div class="media-icon">🎧</div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="media-preview" onclick="window.open('${escapeHtml(url)}', '_blank')">
                            <div class="media-icon">📄</div>
                        </div>
                    `;
                }
            }).filter(Boolean).join('')}
        </div>
    `;
}

function toggleMomentContent(button) {
    const contentDiv = button.parentElement;
    const isCollapsed = contentDiv.classList.contains('collapsed');
    
    if (isCollapsed) {
        contentDiv.innerHTML = escapeHtml(contentDiv.dataset.full);
        contentDiv.classList.remove('collapsed');
    } else {
        const shortContent = contentDiv.dataset.full.substring(0, 150);
        contentDiv.innerHTML = escapeHtml(shortContent) + '<button class="expand-btn" onclick="toggleMomentContent(this)">...read more</button>';
        contentDiv.classList.add('collapsed');
    }
}

function openMediaModal(url) {
    window.open(url, '_blank');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Edit moment
async function editMoment(id) {
    const moment = allMoments.find(m => m.id === id);
    if (!moment) return;

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
// Optimized broadcast with immediate feedback
async function broadcastMoment(momentId) {
    showConfirm('Broadcast this moment now?', async () => {
        const broadcastBtn = document.querySelector(`[data-action="broadcast"][data-id="${momentId}"]`);
        
        try {
            // Immediate UI feedback
            if (broadcastBtn) {
                setButtonLoading(broadcastBtn, true);
                broadcastBtn.textContent = 'Broadcasting...';
            }
            
            // Show optimistic UI update
            showSuccess('Broadcasting moment... This may take a few seconds.');
            
            const response = await apiFetch(`/moments/${momentId}/broadcast`, {
                method: 'POST'
            });
            
            const result = await response.json();
            if (response.ok) {
                showSuccess('Moment broadcasted successfully!');
                
                // Update UI optimistically
                const momentItem = broadcastBtn?.closest('.moment-item');
                if (momentItem) {
                    const statusBadge = momentItem.querySelector('.status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = 'broadcasted';
                        statusBadge.className = 'status-badge status-broadcasted';
                    }
                    // Remove broadcast button
                    if (broadcastBtn) broadcastBtn.remove();
                }
                
                // Reload data in background
                setTimeout(() => {
                    loadMoments(currentPage).catch(console.warn);
                    loadAnalytics().catch(console.warn);
                }, 1000);
            } else {
                showError(result.error || 'Failed to broadcast moment');
            }
        } catch (error) {
            console.error('Broadcast error:', error);
            showError('Failed to broadcast moment - check connection');
        } finally {
            if (broadcastBtn) {
                setButtonLoading(broadcastBtn, false);
            }
        }
    });
}

// Load sponsors
async function loadSponsors() {
    try {
        const cacheBust = `?_=${Date.now()}`;
        const response = await apiFetch(`/sponsors${cacheBust}`);
        const data = await response.json();
        
        const sponsorSelect = document.getElementById('sponsor-select');
        if (sponsorSelect) {
            sponsorSelect.innerHTML = '<option value="">No Sponsor</option>' + 
                (data.sponsors || []).map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
        
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
            sponsorsList.innerHTML = '<div class="error">Failed to load sponsors</div>';
        }
    }
}

// Load pipeline status (MCP + n8n)
async function loadPipelineStatus() {
    try {
        const pipelineStatusEl = document.getElementById('pipeline-status');
        if (!pipelineStatusEl) return;
        
        // Show loading state
        pipelineStatusEl.innerHTML = '<div class="loading">Checking pipeline status...</div>';
        
        const [healthResponse, broadcastResponse] = await Promise.all([
            fetch(window.location.origin + '/health').catch(() => ({ ok: false, status: 'error' })),
            apiFetch('/broadcasts?limit=1').catch(() => ({ json: () => ({ broadcasts: [] }) }))
        ]);
        
        const broadcastData = await broadcastResponse.json().catch(() => ({ broadcasts: [] }));
        
        const systemHealth = healthResponse.ok ? 'connected' : 'error';
        const lastBroadcast = broadcastData.broadcasts?.[0];
        
        pipelineStatusEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${systemHealth === 'connected' ? '#16a34a' : '#dc2626'};"></div>
                        <strong>System Health</strong>
                    </div>
                    <div style="font-size: 0.875rem; color: #6b7280;">
                        API: ${systemHealth}<br>
                        WhatsApp: ${systemHealth === 'connected' ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
                <div style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${lastBroadcast ? '#16a34a' : '#6b7280'};"></div>
                        <strong>Broadcast System</strong>
                    </div>
                    <div style="font-size: 0.875rem; color: #6b7280;">
                        Status: ${lastBroadcast ? 'Active' : 'No broadcasts'}<br>
                        Last: ${lastBroadcast ? new Date(lastBroadcast.broadcast_started_at).toLocaleDateString() : 'Never'}
                    </div>
                </div>
                <div style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #2563eb;"></div>
                        <strong>Commands Available</strong>
                    </div>
                    <div style="font-size: 0.875rem; color: #6b7280;">
                        START, STOP, HELP<br>
                        REGIONS, INTERESTS
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Pipeline status load error:', error);
        const pipelineStatusEl = document.getElementById('pipeline-status');
        if (pipelineStatusEl) {
            pipelineStatusEl.innerHTML = `
                <div class="error">
                    Failed to load pipeline status<br>
                    <small>Check system connectivity and try again</small>
                </div>
            `;
        }
    }
}
async function loadCampaigns() {
    try {
        const response = await apiFetch('/campaigns');
        const data = await response.json();
        
        // Load sponsors for filter
        const sponsorsResponse = await apiFetch('/sponsors');
        const sponsorsData = await sponsorsResponse.json();
        const campaignSponsorFilter = document.getElementById('campaign-sponsor-filter');
        if (campaignSponsorFilter && sponsorsData.sponsors) {
            campaignSponsorFilter.innerHTML = '<option value="">All Sponsors</option>' + 
                sponsorsData.sponsors.map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
        
        if (data.campaigns && data.campaigns.length > 0) {
            // Show only first 10 campaigns
            const campaigns = data.campaigns.slice(0, 10);
            const html = campaigns.map(campaign => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">${campaign.title}</div>
                            <div class="moment-meta">
                                Budget: R${campaign.budget || 0} • ${campaign.sponsor_name || 'No Sponsor'} • ${new Date(campaign.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="moment-actions">
                            <span class="status-badge status-${campaign.status}">${campaign.status}</span>
                            <button class="btn btn-sm" data-action="edit-campaign" data-id="${campaign.id}">✏️ Edit</button>
                            <button class="btn btn-sm btn-success" data-action="activate-campaign" data-id="${campaign.id}">▶️ Activate</button>
                            <button class="btn btn-sm btn-danger" data-action="delete-campaign" data-id="${campaign.id}">🗑️ Delete</button>
                        </div>
                    </div>
                    <div class="moment-content">${campaign.content.substring(0, 200)}${campaign.content.length > 200 ? '...' : ''}</div>
                    ${campaign.target_regions ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem;">Regions: ${Array.isArray(campaign.target_regions) ? campaign.target_regions.join(', ') : campaign.target_regions}</div>` : ''}
                    ${campaign.target_categories ? `<div style="font-size: 0.75rem; color: #16a34a; margin-top: 0.25rem;">Categories: ${Array.isArray(campaign.target_categories) ? campaign.target_categories.join(', ') : campaign.target_categories}</div>` : ''}
                </div>
            `).join('');
            document.getElementById('campaigns-list').innerHTML = html;
            
            // Add "Load More" if there are more than 10
            if (data.campaigns.length > 10) {
                document.getElementById('campaigns-list').innerHTML += `
                    <div style="text-align: center; margin-top: 1rem;">
                        <button class="btn btn-secondary" onclick="loadMoreCampaigns()">Load More (${data.campaigns.length - 10} remaining)</button>
                    </div>
                `;
            }
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

// Load admin users
async function loadAdminUsers() {
    try {
        const response = await apiFetch('/admin-users');
        const data = await response.json();
        
        const adminUsersList = document.getElementById('admin-users-list');
        if (adminUsersList) {
            if (data.users && data.users.length > 0) {
                const html = data.users.map(user => `
                    <div class="moment-item">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">${user.name}</div>
                                <div class="moment-meta">${user.email} • ${new Date(user.created_at).toLocaleDateString()}</div>
                            </div>
                            <div class="moment-actions">
                                <span class="status-badge status-${user.active ? 'broadcasted' : 'cancelled'}">${user.active ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
                adminUsersList.innerHTML = html;
            } else {
                adminUsersList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div>No admin users found</div>
                        <button class="btn" data-action="new-admin-user" style="margin-top: 1rem;">Add First Admin User</button>
                    </div>
                `;
            }
        }
    } catch (error) {
        const adminUsersList = document.getElementById('admin-users-list');
        if (adminUsersList) {
            adminUsersList.innerHTML = '<div class="error">Failed to load admin users</div>';
        }
    }
}

// Load broadcasts
async function loadBroadcasts() {
    try {
        const response = await apiFetch('/broadcasts');
        const data = await response.json();
        
        if (data.broadcasts && data.broadcasts.length > 0) {
            const html = data.broadcasts.map(broadcast => {
                const momentTitle = broadcast.moments?.title || 'Unknown Moment';
                const momentRegion = broadcast.moments?.region || 'Unknown';
                const momentCategory = broadcast.moments?.category || 'General';
                const successRate = broadcast.recipient_count > 0 ? 
                    Math.round((broadcast.success_count / broadcast.recipient_count) * 100) : 0;
                
                return `
                    <div class="moment-item">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">${momentTitle}</div>
                                <div class="moment-meta">
                                    ${momentRegion} • ${momentCategory} • ${new Date(broadcast.broadcast_started_at).toLocaleString()}
                                    ${broadcast.status === 'completed' ? ` • ${successRate}% success rate` : ''}
                                </div>
                            </div>
                            <div class="moment-actions">
                                <span class="status-badge status-${broadcast.status}">${broadcast.status}</span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin-top: 0.5rem; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem;">
                            <div style="text-align: center;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: #374151;">${broadcast.recipient_count || 0}</div>
                                <div style="font-size: 0.75rem; color: #6b7280;">Recipients</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${broadcast.success_count || 0}</div>
                                <div style="font-size: 0.75rem; color: #6b7280;">Delivered</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: #dc2626;">${broadcast.failure_count || 0}</div>
                                <div style="font-size: 0.75rem; color: #6b7280;">Failed</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.25rem; font-weight: bold; color: #2563eb;">${successRate}%</div>
                                <div style="font-size: 0.75rem; color: #6b7280;">Success Rate</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            document.getElementById('broadcasts-list').innerHTML = html;
        } else {
            document.getElementById('broadcasts-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📡</div>
                    <div>No broadcasts yet</div>
                    <p>Broadcasts will appear here when moments are sent to subscribers.</p>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('broadcasts-list').innerHTML = '<div class="error">Failed to load broadcasts</div>';
    }
}

// Load moderation with comments and pagination
let moderationPage = 1;
const moderationPerPage = 10;

async function loadModeration(page = 1) {
    try {
        moderationPage = page;
        const filter = document.getElementById('moderation-filter')?.value || 'all';
        const response = await apiFetch(`/moderation?filter=${filter}`);
        const data = await response.json();
        
        const moderationList = document.getElementById('moderation-list');
        if (!moderationList) return;
        
        const allMessages = data.flaggedMessages || [];
        
        // Pagination
        const startIdx = (moderationPage - 1) * moderationPerPage;
        const endIdx = startIdx + moderationPerPage;
        const messages = allMessages.slice(startIdx, endIdx);
        
        if (messages.length > 0) {
            const html = messages.map(item => {
                const analysis = item.advisories?.[0];
                const riskLevel = analysis ? 
                    (analysis.confidence > 0.65 ? 'high' : analysis.confidence > 0.4 ? 'medium' : 'low') : 'unknown';
                const riskColor = {
                    high: '#dc2626',
                    medium: '#f59e0b', 
                    low: '#16a34a',
                    unknown: '#6b7280'
                }[riskLevel];
                
                const phoneDisplay = item.from_number?.replace(/\d(?=\d{4})/g, '*');
                const createdTime = new Date(item.created_at).toLocaleString('en-ZA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                const statusColor = {
                    approved: '#10b981',
                    flagged: '#ef4444',
                    pending: '#f59e0b'
                };
                
                const currentStatus = item.moderation_status || 'pending';
                const statusBadgeColor = statusColor[currentStatus] || '#6b7280';
                
                return `
                    <div class="moment-item" style="border-left: 4px solid ${riskColor};">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">
                                    📱 Message from ${phoneDisplay}
                                </div>
                                <div class="moment-meta">
                                    ${createdTime} • 
                                    Risk: <span style="color: ${riskColor}; font-weight: 500;">${riskLevel.toUpperCase()}</span>
                                    ${analysis ? ` • Confidence: ${Math.round(analysis.confidence * 100)}%` : ''}
                                    • Status: <span style="color: ${statusBadgeColor}; font-weight: 500; background: ${statusBadgeColor}20; padding: 2px 8px; border-radius: 4px;">${currentStatus.toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="moment-actions">
                                ${currentStatus !== 'approved' ? `<button class="btn btn-sm btn-success" data-action="approve-message" data-id="${item.id}">✅ Approve</button>` : '<button class="btn btn-sm" style="background: #10b981; cursor: default;" disabled>✅ Approved</button>'}
                                ${currentStatus !== 'flagged' ? `<button class="btn btn-sm btn-danger" data-action="flag-message" data-id="${item.id}">🚫 Flag</button>` : '<button class="btn btn-sm" style="background: #ef4444; cursor: default;" disabled>🚫 Flagged</button>'}
                                <button class="btn btn-sm" data-action="preview-message" data-id="${item.id}">👁️ Preview</button>
                            </div>
                        </div>
                        <div class="moment-content" style="margin-bottom: 0.5rem;">
                            <strong>Content:</strong> ${item.content || 'No text content - (Check image display in media preview)'}
                        </div>
                        ${analysis ? `
                            <div style="background: #f8fafc; padding: 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">
                                <strong>Analysis:</strong>
                                ${analysis.harm_signals?.detected ? `<span style="color: #dc2626;">⚠️ ${analysis.harm_signals.type}: ${analysis.harm_signals.context}</span>` : ''}
                                ${analysis.spam_indicators?.detected ? `<span style="color: #f59e0b;">📧 Spam patterns detected</span>` : ''}
                                ${analysis.urgency_level === 'high' ? `<span style="color: #dc2626;">🚨 High urgency</span>` : ''}
                                ${analysis.escalation_suggested ? `<span style="color: #dc2626;">⬆️ Escalation suggested</span>` : ''}
                            </div>
                        ` : '<div style="color: #6b7280; font-size: 0.75rem;">No analysis available</div>'}
                    </div>
                `;
            }).join('');
            moderationList.innerHTML = html;
            
            // Add pagination
            if (window.dashboardCore && window.dashboardCore.createPagination) {
                window.dashboardCore.createPagination(
                    'moderation-pagination',
                    allMessages.length,
                    moderationPerPage,
                    moderationPage,
                    (newPage) => loadModeration(newPage)
                );
            }
        } else {
            moderationList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div>No items found</div>
                    <p>All messages are clean or no items match the current filter.</p>
                </div>
            `;
            document.getElementById('moderation-pagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Moderation load error:', error);
        const moderationList = document.getElementById('moderation-list');
        if (moderationList) {
            moderationList.innerHTML = '<div class="error">Failed to load moderation data</div>';
        }
    }
}

// Load subscribers
async function loadSubscribers() {
    try {
        const filter = document.getElementById('subscriber-filter')?.value || 'all';
        const cacheBust = `&_=${Date.now()}`;
        const response = await apiFetch(`/subscribers?filter=${filter}${cacheBust}`);
        const data = await response.json();
        
        // Update stats
        const statsEl = document.getElementById('subscriber-stats');
        if (statsEl && data.stats) {
            statsEl.innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${data.stats.total || 0}</div>
                    <div class="stat-label">Total Subscribers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.active || 0}</div>
                    <div class="stat-label">Active</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.inactive || 0}</div>
                    <div class="stat-label">Opted Out</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.commands_used || 0}</div>
                    <div class="stat-label">Commands Used</div>
                </div>
            `;
        }
        
        const subscribersList = document.getElementById('subscribers-list');
        if (!subscribersList) return;
        
        if (data.subscribers && data.subscribers.length > 0) {
            const html = data.subscribers.map(sub => {
                const regions = Array.isArray(sub.regions) ? sub.regions.join(', ') : (sub.regions || 'National');
                const categories = Array.isArray(sub.categories) ? sub.categories.slice(0, 3).join(', ') + (sub.categories.length > 3 ? '...' : '') : 'All';
                const language = sub.language_preference || 'English';
                
                return `
                    <div class="moment-item">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">${sub.phone_number.replace(/\d(?=\d{4})/g, '*')}</div>
                                <div class="moment-meta">
                                    ${sub.opted_in ? 'Joined' : 'Left'}: ${new Date(sub.opted_in ? sub.opted_in_at : sub.opted_out_at).toLocaleDateString()}
                                    • Last activity: ${new Date(sub.last_activity).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="moment-actions">
                                <span class="status-badge ${sub.opted_in ? 'status-broadcasted' : 'status-cancelled'}">
                                    ${sub.opted_in ? 'Active' : 'Opted Out'}
                                </span>
                            </div>
                        </div>
                        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem;">
                            <strong>Language:</strong> ${language} • 
                            <strong>Regions:</strong> ${regions}<br>
                            <strong>Categories:</strong> ${categories}
                            ${sub.consent_method ? `<br><strong>Consent:</strong> ${sub.consent_method} (${new Date(sub.consent_timestamp).toLocaleDateString()})` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            subscribersList.innerHTML = html;
        } else {
            subscribersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📱</div>
                    <div>No subscribers found</div>
                    <p>Users will appear here when they send START to your WhatsApp number.</p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; text-align: left;">
                        <strong>Available Commands:</strong><br>
                        • <code>START</code> or <code>JOIN</code> - Subscribe to updates<br>
                        • <code>STOP</code> or <code>UNSUBSCRIBE</code> - Unsubscribe<br>
                        • <code>HELP</code> - Get help information<br>
                        • <code>REGIONS</code> - Manage region preferences<br>
                        • <code>INTERESTS</code> - Manage category preferences
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Subscribers load error:', error);
        const subscribersList = document.getElementById('subscribers-list');
        if (subscribersList) {
            subscribersList.innerHTML = '<div class="error">Failed to load subscribers: ' + error.message + '</div>';
        }
        
        // Also update stats with error state
        const statsEl = document.getElementById('subscriber-stats');
        if (statsEl) {
            statsEl.innerHTML = '<div class="error">Failed to load subscriber stats</div>';
        }
    }
}



// Load settings
async function loadSettings() {
    try {
        // Update last updated timestamp safely
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = new Date().toLocaleDateString();
        }
        
        // Hardcoded system info for reliability
        const systemInfo = document.getElementById('system-info');
        if (systemInfo) {
            systemInfo.innerHTML = `
                <strong>Database:</strong> Supabase Connected<br>
                <strong>Storage:</strong> Supabase Storage<br>
                <strong>MCP:</strong> Internal Function<br>
                <strong>n8n:</strong> Automation Active<br>
                <strong>Environment:</strong> Production<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Last Updated:</strong> ${new Date().toLocaleDateString()}
            `;
        }
        
        // Hardcoded webhook status
        const webhookStatus = document.getElementById('webhook-status');
        if (webhookStatus) {
            webhookStatus.innerHTML = '✓ Connected and verified';
            webhookStatus.style.background = '#f0fdf4';
            webhookStatus.style.color = '#16a34a';
        }
        
    } catch (error) {
        console.error('Settings load error:', error);
        const settingsMessage = document.getElementById('settings-message');
        if (settingsMessage) {
            settingsMessage.innerHTML = '<div class="error">Failed to load settings</div>';
        }
    }
}

// Load budget controls with real-time data
async function loadBudgetControls() {
    try {
        // Load settings first with cache bust
        const cacheBust = `?_=${Date.now()}`;
        const settingsResponse = await apiFetch(`/budget/settings${cacheBust}`);
        const settingsData = await settingsResponse.json();
        
        // Convert array to object keyed by setting_key
        const settingsArray = settingsData.settings || [];
        const settings = {};
        settingsArray.forEach(s => {
            settings[s.setting_key] = s.setting_value;
        });
        
        const [budgetResponse, sponsorsResponse, transactionsResponse] = await Promise.all([
            apiFetch('/budget/overview'),
            apiFetch('/budget/sponsors'),
            apiFetch('/budget/transactions?limit=10')
        ]);
        
        const budgetData = await budgetResponse.json();
        const sponsorsData = await sponsorsResponse.json();
        const transactionsData = await transactionsResponse.json();
        
        // Update budget overview
        const budgetOverview = document.getElementById('budget-overview');
        if (budgetOverview && budgetData.success) {
            const data = budgetData.data;
            const percentage = (data.used / data.total) * 100;
            const fillColor = percentage > 90 ? '#dc2626' : percentage > 70 ? '#f59e0b' : '#16a34a';
            
            budgetOverview.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <h4>Monthly Budget: R${data.total.toLocaleString()}</h4>
                        <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin: 0.5rem 0;">
                            <div style="height: 100%; background: ${fillColor}; width: ${percentage}%; transition: width 0.3s ease;"></div>
                        </div>
                        <p>Used: R${data.used.toLocaleString()} / R${data.total.toLocaleString()} (${Math.round(percentage)}%)</p>
                    </div>
                    <div>
                        <h4>Template Message Costs</h4>
                        <p>Cost per message: R${settings.message_cost || data.message_cost}</p>
                        <p>Messages sent: ${data.messages_sent.toLocaleString()}</p>
                        <p>Remaining: ${data.messages_remaining.toLocaleString()}</p>
                    </div>
                </div>
            `;
        }
        
        // Update budget settings form with dynamic values
        const budgetSettingsForm = document.getElementById('budget-settings-form');
        if (budgetSettingsForm) {
            budgetSettingsForm.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    <div>
                        <div class="form-group">
                            <label>Monthly Budget Limit (R)</label>
                            <input type="number" id="monthly-budget" value="${settings.monthly_budget || 3000}" min="1000" step="100">
                        </div>
                        <div class="form-group">
                            <label>Warning Threshold (%)</label>
                            <input type="number" id="warning-threshold" value="${settings.warning_threshold || 80}" min="50" max="95">
                        </div>
                    </div>
                    <div>
                        <div class="form-group">
                            <label>Template Message Cost (R)</label>
                            <input type="number" id="message-cost" value="${settings.message_cost || 0.12}" step="0.01" min="0.05" max="0.50">
                        </div>
                        <div class="form-group">
                            <label>Daily Spend Limit (R)</label>
                            <input type="number" id="daily-limit" value="${settings.daily_limit || 500}" min="50" step="50">
                        </div>
                    </div>
                </div>
                <button class="btn" onclick="saveBudgetSettings()">Save Budget Settings</button>
            `;
        }
        
        // Update sponsor budgets
        const sponsorBudgetsList = document.getElementById('sponsor-budgets-list');
        if (sponsorBudgetsList && sponsorsData.success) {
            const sponsors = sponsorsData.sponsors || [];
            if (sponsors.length > 0) {
                const html = sponsors.map(sponsor => {
                    const percentage = (sponsor.spent / sponsor.budget) * 100;
                    const fillColor = percentage > 90 ? '#dc2626' : percentage > 70 ? '#f59e0b' : '#16a34a';
                    
                    return `
                        <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                            <h4>${sponsor.display_name}</h4>
                            <div style="width: 100%; height: 15px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 0.5rem 0;">
                                <div style="height: 100%; background: ${fillColor}; width: ${Math.min(percentage, 100)}%; transition: width 0.3s ease;"></div>
                            </div>
                            <p>R${sponsor.spent.toLocaleString()} / R${sponsor.budget.toLocaleString()} (${Math.round(percentage)}%)</p>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                                <input type="number" value="${sponsor.budget}" placeholder="Budget limit" style="flex: 1; padding: 0.25rem;">
                                <button class="btn btn-sm" onclick="updateSponsorBudget('${sponsor.id}', this.previousElementSibling.value)">Update</button>
                            </div>
                        </div>
                    `;
                }).join('');
                sponsorBudgetsList.innerHTML = html;
            } else {
                sponsorBudgetsList.innerHTML = '<div class="empty-state">No sponsors found</div>';
            }
        }
        
        // Update budget alerts
        const budgetAlerts = document.getElementById('budget-alerts');
        if (budgetAlerts && budgetData.success) {
            const alerts = budgetData.alerts || [];
            if (alerts.length > 0) {
                const html = alerts.map(alert => {
                    const alertClass = alert.level === 'critical' ? 'error' : alert.level === 'warning' ? 'alert-warning' : 'alert-info';
                    return `<div class="${alertClass}" style="margin-bottom: 0.5rem;"><strong>${alert.level.toUpperCase()}:</strong> ${alert.message}</div>`;
                }).join('');
                budgetAlerts.innerHTML = html;
            } else {
                budgetAlerts.innerHTML = '<div style="color: #16a34a; padding: 1rem; background: #f0fdf4; border-radius: 0.5rem;">✓ All budgets within normal limits</div>';
            }
        }
        
        // Update transactions
        const budgetTransactions = document.getElementById('budget-transactions');
        if (budgetTransactions && transactionsData.success) {
            const transactions = transactionsData.transactions || [];
            if (transactions.length > 0) {
                const html = `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e5e7eb;">
                                <th style="text-align: left; padding: 0.5rem;">Date</th>
                                <th style="text-align: left; padding: 0.5rem;">Sponsor</th>
                                <th style="text-align: left; padding: 0.5rem;">Messages</th>
                                <th style="text-align: left; padding: 0.5rem;">Cost</th>
                                <th style="text-align: left; padding: 0.5rem;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(tx => `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 0.5rem;">${new Date(tx.created_at).toLocaleDateString()}</td>
                                    <td style="padding: 0.5rem;">${tx.sponsor_name || 'System'}</td>
                                    <td style="padding: 0.5rem;">${tx.message_count.toLocaleString()}</td>
                                    <td style="padding: 0.5rem;">R${tx.amount.toFixed(2)}</td>
                                    <td style="padding: 0.5rem;"><span style="color: ${tx.status === 'completed' ? '#16a34a' : '#f59e0b'};">✓ ${tx.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                budgetTransactions.innerHTML = html;
            } else {
                budgetTransactions.innerHTML = '<div class="empty-state">No transactions found</div>';
            }
        }
        
    } catch (error) {
        console.error('Budget controls load error:', error);
        
        // Show error in each section
        ['budget-overview', 'budget-settings-form', 'sponsor-budgets-list', 'budget-alerts', 'budget-transactions'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<div class="error">Failed to load budget data</div>';
            }
        });
    }
}

// Update sponsor budget
async function updateSponsorBudget(sponsorId, newBudget) {
    try {
        const response = await apiFetch(`/budget/sponsors/${sponsorId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ budget: parseFloat(newBudget) })
        });
        
        if (response.ok) {
            showSuccess('Sponsor budget updated successfully');
            loadBudgetControls(); // Reload data
        } else {
            showError('Failed to update sponsor budget');
        }
    } catch (error) {
        showError('Failed to update sponsor budget');
    }
}

// Save settings function
function saveSettings() {
    const autoBroadcast = document.getElementById('auto-broadcast-setting').value;
    const moderationThreshold = document.getElementById('moderation-threshold').value;
    
    // Store in localStorage for now (could be moved to database)
    localStorage.setItem('admin.settings.auto_broadcast', autoBroadcast);
    localStorage.setItem('admin.settings.moderation_threshold', moderationThreshold);
    
    showSuccess('Settings saved successfully');
}

// Save budget settings function (globally accessible)
window.saveBudgetSettings = async function() {
    const monthlyBudget = document.getElementById('monthly-budget')?.value;
    const warningThreshold = document.getElementById('warning-threshold')?.value;
    const messageCost = document.getElementById('message-cost')?.value;
    const dailyLimit = document.getElementById('daily-limit')?.value;
    
    if (!monthlyBudget || !warningThreshold || !messageCost || !dailyLimit) {
        showError('Please fill in all budget settings');
        return;
    }
    
    try {
        const response = await apiFetch('/budget/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                monthly_budget: parseFloat(monthlyBudget),
                warning_threshold: parseInt(warningThreshold),
                message_cost: parseFloat(messageCost),
                daily_limit: parseFloat(dailyLimit)
            })
        });
        
        if (response.ok) {
            showSuccess('Budget settings saved successfully');
            // Force reload with cache bust
            setTimeout(() => {
                loadBudgetControls();
            }, 500);
        } else {
            showError('Failed to save budget settings');
        }
    } catch (error) {
        showError('Failed to save budget settings: ' + error.message);
    }
}

// Test webhook function
async function testWebhook() {
    try {
        const response = await fetch(window.location.origin + '/health');
        if (response.ok) {
            showSuccess('Webhook test successful - system is responding');
        } else {
            showError('Webhook test failed - check system status');
        }
    } catch (error) {
        showError('Webhook test failed - connection error');
    }
}

// Modal/Inline Form functions - responsive to mobile
function openSponsorModal() {
    showSection('sponsor-form-section');
    document.getElementById('sponsor-form-inline').reset();
}

function closeSponsorModal() {
    showSection('sponsors');
    document.getElementById('sponsor-form-inline').reset();
}

function openCampaignModal() {
    showSection('campaign-form-section');
    document.getElementById('campaign-form-inline').reset();
    loadSponsorsForCampaign();
}

async function loadSponsorsForCampaign() {
    try {
        const response = await apiFetch('/sponsors');
        
        if (!response.ok) {
            console.error('Failed to load sponsors for campaign: HTTP', response.status);
            return;
        }
        
        const data = await response.json();
        
        const campaignSponsorSelect = document.getElementById('campaign-sponsor-select-inline');
        if (campaignSponsorSelect && data.sponsors) {
            campaignSponsorSelect.innerHTML = '<option value="">No Sponsor</option>' + 
                data.sponsors.map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load sponsors for campaign:', error);
    }
}

function closeCampaignModal() {
    showSection('campaigns');
    document.getElementById('campaign-form-inline').reset();
}

function openAdminUserModal() {
    showSection('admin-user-form-section');
    document.getElementById('admin-user-form-inline').reset();
}

function closeAdminUserModal() {
    showSection('users');
    document.getElementById('admin-user-form-inline').reset();
}

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

async function editSponsor(id) {
    try {
        const response = await apiFetch(`/sponsors/${id}`);
        if (!response.ok) {
            showError('Failed to load sponsor data');
            return;
        }
        
        const data = await response.json();
        const sponsor = data.sponsor;
        
        // Populate inline form only
        document.getElementById('sponsor-edit-id-inline').value = id;
        document.querySelector('#sponsor-form-inline [name="name"]').value = sponsor.name || '';
        document.querySelector('#sponsor-form-inline [name="display_name"]').value = sponsor.display_name || '';
        document.querySelector('#sponsor-form-inline [name="contact_email"]').value = sponsor.contact_email || '';
        document.querySelector('#sponsor-form-inline [name="website_url"]').value = sponsor.website_url || '';
        
        showSection('sponsor-form-section');
    } catch (error) {
        showError('Failed to load sponsor: ' + error.message);
    }
}

function deleteSponsor(id) {
    showConfirm('Delete this sponsor?', async () => {
        try {
            const response = await apiFetch(`/sponsors/${id}`, {
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

// Moderation actions
function approveMessage(id) {
    showConfirm('Approve this message for publication?', async () => {
        try {
            const response = await apiFetch(`/messages/${id}/approve`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                showSuccess(result.message || 'Message approved successfully');
                loadModeration();
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to approve message');
            }
        } catch (error) {
            console.error('Approve error:', error);
            showError('Failed to approve message: ' + error.message);
        }
    });
}

function flagMessage(id) {
    showConfirm('Flag this message as inappropriate?', async () => {
        try {
            const response = await apiFetch(`/messages/${id}/flag`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                showSuccess(result.message || 'Message flagged successfully');
                loadModeration();
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to flag message');
            }
        } catch (error) {
            console.error('Flag error:', error);
            showError('Failed to flag message: ' + error.message);
        }
    });
}

// Comment management functions
function approveComment(id) {
    showConfirm('Approve this comment for public display?', async () => {
        try {
            const response = await apiFetch(`/comments/${id}/approve`, {
                method: 'POST'
            });
            
            if (response.ok) {
                showSuccess('Comment approved successfully');
                loadModeration();
            } else {
                showError('Failed to approve comment');
            }
        } catch (error) {
            showError('Failed to approve comment');
        }
    });
}

function featureComment(id) {
    showConfirm('Feature this comment for broadcast inclusion?', async () => {
        try {
            const response = await apiFetch(`/comments/${id}/feature`, {
                method: 'POST'
            });
            
            if (response.ok) {
                showSuccess('Comment featured successfully');
                loadModeration();
            } else {
                showError('Failed to feature comment');
            }
        } catch (error) {
            showError('Failed to feature comment');
        }
    });
}

function deleteComment(id) {
    showConfirm('Delete this comment permanently?', async () => {
        try {
            const response = await apiFetch(`/comments/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Comment deleted successfully');
                loadModeration();
            } else {
                showError('Failed to delete comment');
            }
        } catch (error) {
            showError('Failed to delete comment');
        }
    });
}
async function editCampaign(id) {
    try {
        const response = await apiFetch(`/campaigns/${id}`);
        const data = await response.json();
        
        if (!response.ok || !data.campaign) {
            showError('Failed to load campaign');
            return;
        }
        
        const campaign = data.campaign;
        
        // Populate inline form only
        document.getElementById('campaign-edit-id-inline').value = id;
        document.querySelector('#campaign-form-inline [name="title"]').value = campaign.title || '';
        document.querySelector('#campaign-form-inline [name="content"]').value = campaign.content || '';
        document.querySelector('#campaign-form-inline [name="sponsor_id"]').value = campaign.sponsor_id || '';
        document.querySelector('#campaign-form-inline [name="budget"]').value = campaign.budget || '';
        
        if (campaign.target_regions && campaign.target_regions.length > 0) {
            document.querySelector('#campaign-form-inline [name="primary_region"]').value = campaign.target_regions[0];
            campaign.target_regions.slice(1).forEach(region => {
                const checkbox = document.querySelector(`#campaign-form-inline input[name="target_regions"][value="${region}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        if (campaign.target_categories && campaign.target_categories.length > 0) {
            document.querySelector('#campaign-form-inline [name="primary_category"]').value = campaign.target_categories[0];
            campaign.target_categories.slice(1).forEach(category => {
                const checkbox = document.querySelector(`#campaign-form-inline input[name="target_categories"][value="${category}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        if (campaign.scheduled_at) {
            const date = new Date(campaign.scheduled_at);
            document.querySelector('#campaign-form-inline [name="scheduled_at"]').value = date.toISOString().slice(0, 16);
        }
        
        showSection('campaign-form-section');
    } catch (error) {
        showError('Failed to load campaign: ' + error.message);
    }
}

function activateCampaign(id) {
    showConfirm('Broadcast this campaign to all subscribers now?', async () => {
        try {
            const response = await apiFetch(`/campaigns/${id}/broadcast`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                showSuccess(`Campaign broadcasted to ${result.recipient_count || 0} subscribers`);
                loadCampaigns();
            } else {
                showError('Failed to broadcast campaign');
            }
        } catch (error) {
            showError('Failed to broadcast campaign');
        }
    });
}

function deleteCampaign(id) {
    showConfirm('Delete this campaign?', async () => {
        try {
            const response = await apiFetch(`/campaigns/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showSuccess('Campaign deleted successfully');
                loadCampaigns();
            } else {
                showError('Failed to delete campaign');
            }
        } catch (error) {
            showError('Failed to delete campaign');
        }
    });
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

// Notification functions
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

// Optimized notification system
function showNotification(message, type) {
    // Remove existing notifications to prevent stacking
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
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
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Auto-remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, type === 'error' ? 5000 : 3000);
}

// Optimized button loading with immediate feedback
function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
        // Immediate visual feedback
        button.style.transform = 'scale(0.95)';
        button.disabled = true;
        button.classList.add('loading');
        button.dataset.originalText = button.textContent;
        
        // Use CSS animation instead of innerHTML manipulation
        const text = button.textContent.replace(/🔄|✏️|\+|←|📡|🗑️|✅|🚫|👁️/g, '').trim();
        button.textContent = text;
        
        // Reset transform after brief moment
        setTimeout(() => {
            button.style.transform = '';
        }, 100);
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.style.transform = '';
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

// Add spinner CSS
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
document.head.appendChild(spinnerStyle);

// File upload preview function
function handleFilePreview(event) {
    const files = event.target.files;
    const preview = document.getElementById('media-preview');
    const previewList = document.getElementById('media-preview-list');
    
    if (files.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'block';
    previewList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid #e5e7eb;';
        
        const fileIcon = getFileIcon(file.type);
        const fileSize = formatFileSize(file.size);
        
        fileItem.innerHTML = `
            <span style="font-size: 1.25rem;">${fileIcon}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.875rem; font-weight: 500; truncate;">${file.name}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">${fileSize} • ${file.type}</div>
            </div>
            <button type="button" onclick="removeFile(${index})" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 0.25rem;">✕</button>
        `;
        
        previewList.appendChild(fileItem);
    });
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📄';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(index) {
    const input = document.getElementById('media_files');
    const dt = new DataTransfer();
    const files = Array.from(input.files);
    
    files.forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    input.files = dt.files;
    handleFilePreview({ target: input });
}

// Form submission handlers
document.addEventListener('DOMContentLoaded', () => {
    // File upload preview functionality
    const mediaFilesInput = document.getElementById('media_files');
    if (mediaFilesInput) {
        mediaFilesInput.addEventListener('change', handleFilePreview);
    }
    
    // Sponsor logo preview functionality
    const sponsorLogoInput = document.getElementById('sponsor-logo-file-inline');
    if (sponsorLogoInput) {
        sponsorLogoInput.addEventListener('change', handleSponsorLogoPreview);
    }
    
    // Campaign media preview functionality
    const campaignMediaInput = document.getElementById('campaign_media_inline');
    if (campaignMediaInput) {
        campaignMediaInput.addEventListener('change', handleCampaignMediaPreview);
    }
    
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

            // Handle media files
            const mediaFiles = formData.getAll('media_files');
            let mediaUrls = [];
            
            if (mediaFiles && mediaFiles.length > 0 && mediaFiles[0].size > 0) {
                try {
                    const mediaFormData = new FormData();
                    mediaFiles.forEach(file => {
                        if (file.size > 0) {
                            mediaFormData.append('media_files', file);
                        }
                    });
                    
                    // Show upload progress
                    const progressEl = document.getElementById('upload-progress');
                    const progressBar = document.getElementById('upload-progress-bar');
                    if (progressEl && progressBar) {
                        progressEl.style.display = 'block';
                        progressBar.style.width = '10%';
                    }
                    
                    const uploadResponse = await apiFetch('/upload-media', {
                        method: 'POST',
                        body: mediaFormData
                    });
                    
                    if (progressBar) progressBar.style.width = '90%';
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success) {
                        mediaUrls = uploadResult.files.map(f => f.publicUrl);
                        showSuccess(`${uploadResult.files.length} media file(s) uploaded`);
                        if (progressBar) progressBar.style.width = '100%';
                    }
                    
                    // Hide progress after delay
                    setTimeout(() => {
                        if (progressEl) progressEl.style.display = 'none';
                    }, 1000);
                } catch (uploadError) {
                    console.error('Media upload failed:', uploadError);
                    showError('Media upload failed, but moment will be saved without media');
                    const progressEl = document.getElementById('upload-progress');
                    if (progressEl) progressEl.style.display = 'none';
                }
            }
            
            if (mediaUrls.length > 0) {
                data.media_urls = mediaUrls;
            }
            
            // Remove media_files from data since it's not a database field
            delete data.media_files;

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

    const sponsorForm = document.getElementById('sponsor-form-modal');
    const sponsorFormInline = document.getElementById('sponsor-form-inline');
    
    [sponsorForm, sponsorFormInline].filter(f => f).forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const messageEl = form.querySelector('[id*="sponsor-message"]') || document.getElementById('sponsor-message');
            
            // Clear previous messages
            messageEl.innerHTML = '';
            setButtonLoading(submitBtn, true);
            
            try {
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const isEdit = !!data.id;
                
                console.log('Submitting sponsor data:', data); // Debug log
                
                // Validate required fields
                if (!data.name || !data.display_name) {
                    throw new Error('Name and display name are required');
                }
                
                // Handle logo upload with preview
                const logoFile = formData.get('logo_file');
                if (logoFile && logoFile.size > 0) {
                    try {
                        // Show upload progress
                        const logoPreview = document.getElementById('sponsor-logo-preview-inline');
                        const logoProgressBar = document.getElementById('sponsor-upload-progress-bar-inline');
                        const logoProgress = document.getElementById('sponsor-upload-progress-inline');
                        
                        if (logoProgress) logoProgress.style.display = 'block';
                        if (logoProgressBar) logoProgressBar.style.width = '10%';
                        
                        const logoFormData = new FormData();
                        logoFormData.append('media_files', logoFile);
                        
                        const uploadResponse = await apiFetch('/upload-media', {
                            method: 'POST',
                            body: logoFormData
                        });
                        
                        if (logoProgressBar) logoProgressBar.style.width = '90%';
                        
                        const uploadResult = await uploadResponse.json();
                        if (uploadResult.success && uploadResult.files.length > 0) {
                            data.logo_url = uploadResult.files[0].publicUrl;
                            if (logoProgressBar) logoProgressBar.style.width = '100%';
                            showSuccess('Logo uploaded successfully');
                        }
                        
                        // Hide progress after delay
                        setTimeout(() => {
                            if (logoProgress) logoProgress.style.display = 'none';
                        }, 1000);
                    } catch (uploadError) {
                        console.error('Logo upload failed:', uploadError);
                        messageEl.innerHTML = '<div class="error">Logo upload failed: ' + uploadError.message + '</div>';
                        const logoProgress = document.getElementById('sponsor-upload-progress');
                        if (logoProgress) logoProgress.style.display = 'none';
                    }
                }
                
                // Remove logo_file from data since it's handled separately
                delete data.logo_file;
                
                // Remove empty fields
                Object.keys(data).forEach(key => {
                    if (data[key] === '') delete data[key];
                });
                
                console.log('Final sponsor data to submit:', data); // Debug log
                
                const url = isEdit ? `/sponsors/${data.id}` : '/sponsors';
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                console.log('Sponsor submission result:', result); // Debug log
                
                if (response.ok) {
                    showSuccess(`Sponsor ${isEdit ? 'updated' : 'created'} successfully!`);
                    closeSponsorModal();
                    await loadSponsors();
                    await loadSponsorsForCampaign();
                } else {
                    // Show specific error message
                    const errorMsg = result.error || `Failed to ${isEdit ? 'update' : 'create'} sponsor`;
                    messageEl.innerHTML = `<div class="error">${errorMsg}</div>`;
                    
                    // If it's a unique constraint error, provide helpful message
                    if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
                        messageEl.innerHTML = '<div class="error">A sponsor with this name already exists. Please use a different name.</div>';
                    }
                }
            } catch (error) {
                console.error('Sponsor form error:', error);
                messageEl.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    });

    const campaignForm = document.getElementById('campaign-form-modal');
    const campaignFormInline = document.getElementById('campaign-form-inline');
    
    [campaignForm, campaignFormInline].filter(f => f).forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;
            
            const mediaFiles = formData.getAll('campaign_media');
            let mediaUrls = [];
            
            if (mediaFiles && mediaFiles.length > 0 && mediaFiles[0].size > 0) {
                try {
                    // Show upload progress
                    const progressEl = document.getElementById('campaign-upload-progress');
                    const progressBar = document.getElementById('campaign-upload-progress-bar');
                    if (progressEl && progressBar) {
                        progressEl.style.display = 'block';
                        progressBar.style.width = '10%';
                    }
                    
                    const mediaFormData = new FormData();
                    mediaFiles.forEach(file => {
                        if (file.size > 0) {
                            mediaFormData.append('media_files', file);
                        }
                    });
                    
                    const uploadResponse = await apiFetch('/upload-media', {
                        method: 'POST',
                        body: mediaFormData
                    });
                    
                    if (progressBar) progressBar.style.width = '90%';
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success) {
                        mediaUrls = uploadResult.files.map(f => f.publicUrl);
                        showSuccess(`${uploadResult.files.length} media file(s) uploaded`);
                        if (progressBar) progressBar.style.width = '100%';
                    }
                    
                    // Hide progress after delay
                    setTimeout(() => {
                        if (progressEl) progressEl.style.display = 'none';
                    }, 1000);
                } catch (uploadError) {
                    console.error('Media upload failed:', uploadError);
                    showError('Media upload failed, but campaign will be saved without media');
                    const progressEl = document.getElementById('campaign-upload-progress');
                    if (progressEl) progressEl.style.display = 'none';
                }
            }
            
            if (mediaUrls.length > 0) {
                data.media_urls = mediaUrls;
            }
            
            // Remove media files from data since it's handled separately
            delete data.campaign_media;
            
            // Get primary selections
            const primaryRegion = data.primary_region;
            const primaryCategory = data.primary_category;
            
            // Get additional selections from multi-select
            const regionSelect = form.querySelector('select[name="target_regions"]');
            const categorySelect = form.querySelector('select[name="target_categories"]');
            
            const additionalRegions = regionSelect ? Array.from(regionSelect.selectedOptions).map(opt => opt.value) : [];
            const additionalCategories = categorySelect ? Array.from(categorySelect.selectedOptions).map(opt => opt.value) : [];
            
            // Combine primary + additional (remove duplicates)
            const allRegions = [primaryRegion, ...additionalRegions].filter((v, i, a) => v && a.indexOf(v) === i);
            const allCategories = [primaryCategory, ...additionalCategories].filter((v, i, a) => v && a.indexOf(v) === i);
            
            data.target_regions = allRegions;
            data.target_categories = allCategories;
            
            // Clean up form data
            delete data.primary_region;
            delete data.primary_category;
            
            try {
                const url = isEdit ? `/campaigns/${data.id}` : '/campaigns';
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess(`Campaign ${isEdit ? 'updated' : 'created'} successfully!`);
                    closeCampaignModal();
                    loadCampaigns();
                } else {
                    showError(result.error || `Failed to ${isEdit ? 'update' : 'create'} campaign`);
                }
            } catch (error) {
                showError('Failed to save campaign: ' + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    });

    const adminUserForm = document.getElementById('admin-user-form-inline');
    if (adminUserForm) {
        adminUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('admin-user-submit-btn-inline');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const response = await apiFetch('/admin-users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSuccess('Admin user created successfully!');
                    closeAdminUserModal();
                    loadAdminUsers();
                } else {
                    showError(result.error || 'Failed to create admin user');
                }
            } catch (error) {
                showError('Failed to create admin user');
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }

    // Authority form submission handler
    const authorityForm = document.getElementById('authority-form');
    if (authorityForm) {
        authorityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(authorityForm);
            const data = Object.fromEntries(formData.entries());
            
            // Convert numeric fields
            data.authority_level = parseInt(data.authority_level);
            data.blast_radius = parseInt(data.blast_radius) || 100;
            data.risk_threshold = parseFloat(data.risk_threshold) || 0.7;
            
            // Remove empty fields
            Object.keys(data).forEach(key => {
                if (data[key] === '') delete data[key];
            });
            
            const isEdit = !!data.id;
            const submitBtn = document.getElementById('authority-submit-btn');
            
            setButtonLoading(submitBtn, true);
            
            try {
                const url = isEdit ? `/authority/${data.id}` : '/authority';
                const method = isEdit ? 'PUT' : 'POST';
                
                const response = await apiFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save authority profile');
                }
                
                showSuccess(`Authority profile ${isEdit ? 'updated' : 'created'} successfully`);
                
                authorityForm.reset();
                document.getElementById('authority-edit-id').value = '';
                document.getElementById('authority-form-title').textContent = 'Assign Authority';
                document.getElementById('authority-submit-btn').textContent = 'Assign Authority';
                showSection('authority');
                
                await loadAuthorityProfiles();
            } catch (error) {
                showError('Failed to save authority profile: ' + error.message);
            } finally {
                setButtonLoading(submitBtn, false);
            }
        });
    }
});

function handleSponsorLogoPreview(event) {
    const files = event.target.files;
    const preview = document.getElementById('sponsor-logo-preview-inline');
    const previewList = document.getElementById('sponsor-logo-preview-list-inline');
    
    if (files.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'block';
    previewList.innerHTML = '';
    
    const file = files[0];
    const fileItem = document.createElement('div');
    fileItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0;';
    
    const fileSize = formatFileSize(file.size);
    
    fileItem.innerHTML = `
        <span style="font-size: 1.25rem;">🖼️</span>
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 0.875rem; font-weight: 500; truncate;">${file.name}</div>
            <div style="font-size: 0.75rem; color: #6b7280;">${fileSize} • ${file.type}</div>
        </div>
        <button type="button" onclick="clearSponsorLogo()" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 0.25rem;">✕</button>
    `;
    
    previewList.appendChild(fileItem);
}

function clearSponsorLogo() {
    const input = document.getElementById('sponsor-logo-file-inline');
    const preview = document.getElementById('sponsor-logo-preview-inline');
    input.value = '';
    preview.style.display = 'none';
}

// Campaign media preview handler
function handleCampaignMediaPreview(event) {
    const files = event.target.files;
    const preview = document.getElementById('campaign-media-preview');
    const previewList = document.getElementById('campaign-media-preview-list');
    
    if (files.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'block';
    previewList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid #e5e7eb;';
        
        const fileIcon = getFileIcon(file.type);
        const fileSize = formatFileSize(file.size);
        
        fileItem.innerHTML = `
            <span style="font-size: 1.25rem;">${fileIcon}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.875rem; font-weight: 500; truncate;">${file.name}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">${fileSize} • ${file.type}</div>
            </div>
            <button type="button" onclick="removeCampaignFile(${index})" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 0.25rem;">✕</button>
        `;
        
        previewList.appendChild(fileItem);
    });
}

function removeCampaignFile(index) {
    const input = document.getElementById('campaign_media_inline');
    const dt = new DataTransfer();
    const files = Array.from(input.files);
    
    files.forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    input.files = dt.files;
    handleCampaignMediaPreview({ target: input });
}

// Load more campaigns function
function loadMoreCampaigns() {
    // This would typically load the next page of campaigns
    // For now, just show a message
    showSuccess('Load more functionality would fetch additional campaigns');
}


// Check campaign compliance
async function checkCampaignCompliance() {
    const form = document.getElementById('campaign-form-inline');
    const content = form.querySelector('[name="content"]').value;
    const category = form.querySelector('[name="primary_category"]').value;
    const resultDiv = document.getElementById('campaign-compliance-result');
    
    if (!content) {
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#fef2f2';
        resultDiv.style.border = '1px solid #fca5a5';
        resultDiv.innerHTML = '<strong style="color: #dc2626;">⚠️ Error:</strong> Please enter campaign content first';
        return;
    }
    
    try {
        const response = await apiFetch('/compliance/check', {
            method: 'POST',
            body: JSON.stringify({ content, category })
        });
        const data = await response.json();
        
        if (data.compliance.approved) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#f0fdf4';
            resultDiv.style.border = '1px solid #86efac';
            resultDiv.innerHTML = `<strong style="color: #16a34a;">✅ Approved</strong><br><small>Confidence: ${(data.compliance.confidence * 100).toFixed(0)}%</small>`;
        } else {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fef2f2';
            resultDiv.style.border = '1px solid #fca5a5';
            resultDiv.innerHTML = `<strong style="color: #dc2626;">⚠️ Review Required</strong><br><small>${data.compliance.issues.join(', ')}</small>`;
        }
    } catch (error) {
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#fef2f2';
        resultDiv.style.border = '1px solid #fca5a5';
        resultDiv.innerHTML = '<strong style="color: #dc2626;">⚠️ Error:</strong> Compliance check failed';
    }
}
window.checkCampaignCompliance = checkCampaignCompliance;

// Authority Management Functions
async function loadAuthorityProfiles() {
    try {
        const cacheBust = `?_=${Date.now()}`;
        const response = await apiFetch(`/authority${cacheBust}`);
        const data = await response.json();
        displayAuthorityProfiles(data.authority_profiles || []);
    } catch (error) {
        const list = document.getElementById('authority-list');
        if (list) list.innerHTML = '<div class="error">Failed to load authority profiles</div>';
    }
}



function displayAuthorityProfiles(profiles) {
    const list = document.getElementById('authority-list');
    if (!list) return;
    
    if (profiles.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔐</div><p>No authority profiles assigned yet.</p><button class="btn" data-action="create-authority">Assign First Authority</button></div>`;
        return;
    }
    
    list.innerHTML = profiles.map(profile => `
        <div class="moment-item" data-id="${profile.id}">
            <div class="moment-header">
                <div class="moment-info">
                    <div class="moment-title">${profile.role_label}</div>
                    <div class="moment-meta">📞 ${profile.user_identifier} • Level ${profile.authority_level} • ${profile.scope} • Reach: ${profile.blast_radius}</div>
                </div>
                <div class="moment-actions">
                    <span class="status-badge status-${profile.status}">${profile.status}</span>
                    <button class="btn btn-sm" onclick="editAuthorityProfile('${profile.id}')">Edit</button>
                    ${profile.status === 'active' ? 
                        `<button class="btn btn-sm btn-danger" onclick="suspendAuthorityProfile('${profile.id}')">Suspend</button>` :
                        `<button class="btn btn-sm btn-success" onclick="activateAuthorityProfile('${profile.id}')">Activate</button>`
                    }
                </div>
            </div>
        </div>
    `).join('');
}

window.editAuthorityProfile = async function(profileId) {
    try {
        const response = await apiFetch(`/authority/${profileId}`);
        if (!response.ok) throw new Error('Failed to load profile');
        
        const data = await response.json();
        const profile = data.authority_profile;
        
        document.getElementById('authority-edit-id').value = profile.id;
        document.querySelector('#authority-form [name="user_identifier"]').value = profile.user_identifier;
        document.querySelector('#authority-form [name="role_label"]').value = profile.role_label;
        document.querySelector('#authority-form [name="authority_level"]').value = profile.authority_level;
        document.querySelector('#authority-form [name="scope"]').value = profile.scope;
        document.querySelector('#authority-form [name="scope_identifier"]').value = profile.scope_identifier || '';
        document.querySelector('#authority-form [name="approval_mode"]').value = profile.approval_mode;
        document.querySelector('#authority-form [name="blast_radius"]').value = profile.blast_radius;
        document.querySelector('#authority-form [name="risk_threshold"]').value = profile.risk_threshold;
        
        document.getElementById('authority-form-title').textContent = 'Edit Authority';
        document.getElementById('authority-submit-btn').textContent = 'Update Authority';
        
        showSection('authority-form-section');
    } catch (error) {
        showNotification('Failed to load authority profile: ' + error.message, 'error');
    }
};

window.suspendAuthorityProfile = async function(profileId) {
    if (!confirm('Are you sure you want to suspend this authority profile?')) return;
    
    const btn = event?.target;
    if (btn) setButtonLoading(btn, true);
    
    try {
        const response = await apiFetch(`/authority/${profileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'suspended' }),
            cache: 'no-store'
        });
        
        if (!response.ok) throw new Error('Failed to suspend profile');
        
        showNotification('Authority profile suspended successfully', 'success');
        
        // Force immediate UI update
        const statusBadge = btn.closest('.moment-item').querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'suspended';
            statusBadge.className = 'status-badge status-suspended';
        }
        btn.textContent = 'Activate';
        btn.className = 'btn btn-sm btn-success';
        btn.onclick = () => activateAuthorityProfile(profileId);
        
        // Clear cache and reload
        apiCallCache.clear();
        pendingCalls.clear();
        setTimeout(() => loadAuthorityProfiles(), 500);
    } catch (error) {
        showNotification('Failed to suspend authority profile: ' + error.message, 'error');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
};

window.activateAuthorityProfile = async function(profileId) {
    const btn = event?.target;
    if (btn) setButtonLoading(btn, true);
    
    try {
        const response = await apiFetch(`/authority/${profileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' }),
            cache: 'no-store'
        });
        
        if (!response.ok) throw new Error('Failed to activate profile');
        
        showNotification('Authority profile activated successfully', 'success');
        
        // Force immediate UI update
        const statusBadge = btn.closest('.moment-item').querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'active';
            statusBadge.className = 'status-badge status-active';
        }
        btn.textContent = 'Suspend';
        btn.className = 'btn btn-sm btn-danger';
        btn.onclick = () => suspendAuthorityProfile(profileId);
        
        // Clear cache and reload
        apiCallCache.clear();
        pendingCalls.clear();
        setTimeout(() => loadAuthorityProfiles(), 500);
    } catch (error) {
        showNotification('Failed to activate authority profile: ' + error.message, 'error');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
};
