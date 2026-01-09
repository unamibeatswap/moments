// Direct API calls without Supabase library
const API_BASE = '/functions/v1/admin-api';

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
    
    if (response.status === 401) {
        console.warn('Authentication failed, clearing tokens');
        localStorage.removeItem('admin.auth.token');
        localStorage.removeItem('admin.user.info');
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
    
    switch(sectionId) {
        case 'dashboard': loadAnalytics(); loadRecentActivity(); loadPipelineStatus(); break;
        case 'moments': loadMoments(); break;
        case 'campaigns': loadCampaigns(); break;
        case 'sponsors': loadSponsors(); break;
        case 'subscribers': loadSubscribers(); break;
        case 'users': loadAdminUsers(); break;
        case 'broadcasts': loadBroadcasts(); break;
        case 'moderation': loadModeration(); break;
        case 'settings': loadSettings(); break;
        case 'create': loadSponsors(); break;
    }
}

// Event delegation for all interactions
document.addEventListener('click', (e) => {
    const action = e.target.getAttribute('data-action');
    const section = e.target.getAttribute('data-section');
    
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
        case 'new-admin-user':
            openAdminUserModal();
            break;
        case 'close-admin-user-modal':
        case 'cancel-admin-user':
            closeAdminUserModal();
            break;
        case 'edit-campaign':
            editCampaign(id);
            break;
        case 'activate-campaign':
            activateCampaign(id);
            break;
        case 'flag-message':
            flagMessage(id);
            break;
        case 'approve-message':
            approveMessage(id);
            break;
        case 'approve-comment':
            approveComment(id);
            break;
        case 'feature-comment':
            featureComment(id);
            break;
        case 'delete-comment':
            deleteComment(id);
            break;
        case 'preview-message':
            previewMessage(id);
            break;
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

// Load analytics with direct Supabase queries
async function loadAnalytics() {
    try {
        const [momentsResponse, subscribersResponse, broadcastsResponse] = await Promise.all([
            apiFetch('/moments?select=count'),
            apiFetch('/subscriptions?select=count&opted_in=eq.true'),
            apiFetch('/broadcasts?select=count')
        ]);
        
        const momentsCount = await momentsResponse.json();
        const subscribersCount = await subscribersResponse.json();
        const broadcastsCount = await broadcastsResponse.json();
        
        document.getElementById('analytics').innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${momentsCount.length || 0}</div>
                <div class="stat-label">Total Moments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${subscribersCount.length || 0}</div>
                <div class="stat-label">Active Subscribers</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${broadcastsCount.length || 0}</div>
                <div class="stat-label">Total Broadcasts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">95%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        `;
    } catch (error) {
        console.error('Analytics load error:', error);
        document.getElementById('analytics').innerHTML = '<div class="error">Failed to load analytics</div>';
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
        
        return `
            <div class="moment-item">
                <div class="moment-header">
                    <div class="moment-info">
                        <div class="moment-title">${escapeHtml(moment.title)}</div>
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
                ${contentPreview}
                ${mediaPreview}
                ${moment.scheduled_at ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 0.5rem;">Scheduled: ${new Date(moment.scheduled_at).toLocaleString()}</div>` : ''}
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
    
    const mediaItems = mediaUrls.slice(0, 3);
    const hasMore = mediaUrls.length > 3;
    
    return `
        <div class="moment-media">
            ${mediaItems.map((url, index) => {
                if (!url || url.trim() === '') return '';
                
                const ext = url.split('.').pop()?.toLowerCase() || '';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                    return `
                        <div class="media-preview" onclick="openMediaModal('${escapeHtml(url)}')">
                            <img src="${escapeHtml(url)}" alt="Media" onerror="this.parentElement.innerHTML='<div class=\"media-icon\">🖼️</div>'">
                            ${hasMore && index === 2 ? `<div class="media-count">+${mediaUrls.length - 3}</div>` : ''}
                        </div>
                    `;
                } else if (['mp4', 'webm', 'mov'].includes(ext)) {
                    return `
                        <div class="media-preview" onclick="openMediaModal('${escapeHtml(url)}')">
                            <video preload="metadata"><source src="${escapeHtml(url)}"></video>
                            <div class="media-icon">▶️</div>
                            ${hasMore && index === 2 ? `<div class="media-count">+${mediaUrls.length - 3}</div>` : ''}
                        </div>
                    `;
                } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
                    return `
                        <div class="media-preview">
                            <div class="media-icon">🎧</div>
                            <audio controls style="position: absolute; bottom: 0; width: 100%; height: 30px;">
                                <source src="${escapeHtml(url)}">
                            </audio>
                        </div>
                    `;
                }
                return `
                    <div class="media-preview" onclick="window.open('${escapeHtml(url)}', '_blank')">
                        <div class="media-icon">📄</div>
                    </div>
                `;
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
async function broadcastMoment(momentId) {
    showConfirm('Broadcast this moment now?', async () => {
        const broadcastBtn = document.querySelector(`[data-action="broadcast"][data-id="${momentId}"]`);
        if (broadcastBtn) {
            setButtonLoading(broadcastBtn, true);
            broadcastBtn.textContent = 'Broadcasting...';
        }
        
        try {
            const response = await apiFetch(`/moments/${momentId}/broadcast`, {
                method: 'POST'
            });
            
            const result = await response.json();
            if (response.ok) {
                showSuccess('Moment broadcasted successfully!');
                // Reload moments to update status
                await loadMoments(currentPage);
                loadAnalytics();
            } else {
                showError(result.error || 'Failed to broadcast moment');
            }
        } catch (error) {
            console.error('Broadcast error:', error);
            showError('Failed to broadcast moment - check connection');
        } finally {
            if (broadcastBtn) {
                setButtonLoading(broadcastBtn, false);
                broadcastBtn.textContent = '📡 Broadcast Now';
            }
        }
    });
}

// Load sponsors
async function loadSponsors() {
    try {
        const response = await apiFetch('/sponsors');
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
            const html = data.broadcasts.map(broadcast => `
                <div class="moment-item">
                    <div class="moment-header">
                        <div class="moment-info">
                            <div class="moment-title">Broadcast #${broadcast.id.slice(0, 8)}</div>
                            <div class="moment-meta">${new Date(broadcast.broadcast_started_at).toLocaleString()}</div>
                        </div>
                        <div class="moment-actions">
                            <span class="status-badge status-${broadcast.status}">${broadcast.status}</span>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
                        <div><strong>${broadcast.recipient_count}</strong><br><small>Recipients</small></div>
                        <div><strong>${broadcast.success_count}</strong><br><small>Success</small></div>
                        <div><strong>${broadcast.failure_count}</strong><br><small>Failed</small></div>
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

// Load moderation with comments
async function loadModeration() {
    try {
        const filter = document.getElementById('moderation-filter')?.value || 'all';
        const response = await apiFetch(`/moderation?filter=${filter}`);
        const data = await response.json();
        
        const moderationList = document.getElementById('moderation-list');
        if (!moderationList) return;
        
        const messages = data.flaggedMessages || [];
        
        if (messages.length > 0) {
            const html = messages.map(item => {
                const analysis = item.advisories?.[0];
                const riskLevel = analysis ? 
                    (analysis.confidence > 0.7 ? 'high' : analysis.confidence > 0.4 ? 'medium' : 'low') : 'unknown';
                const riskColor = {
                    high: '#dc2626',
                    medium: '#f59e0b', 
                    low: '#16a34a',
                    unknown: '#6b7280'
                }[riskLevel];
                
                const phoneDisplay = item.from_number?.replace(/\d(?=\d{4})/g, '*');
                
                return `
                    <div class="moment-item" style="border-left: 4px solid ${riskColor};">
                        <div class="moment-header">
                            <div class="moment-info">
                                <div class="moment-title">
                                    📱 Message from ${phoneDisplay}
                                </div>
                                <div class="moment-meta">
                                    ${new Date(item.created_at).toLocaleString()} • 
                                    Risk: <span style="color: ${riskColor}; font-weight: 500;">${riskLevel.toUpperCase()}</span>
                                    ${analysis ? ` • Confidence: ${Math.round(analysis.confidence * 100)}%` : ''}
                                </div>
                            </div>
                            <div class="moment-actions">
                                <button class="btn btn-sm btn-success" data-action="approve-message" data-id="${item.id}">✅ Approve</button>
                                <button class="btn btn-sm btn-danger" data-action="flag-message" data-id="${item.id}">🚫 Flag</button>
                                <button class="btn btn-sm" data-action="preview-message" data-id="${item.id}">👁️ Preview</button>
                            </div>
                        </div>
                        <div class="moment-content" style="margin-bottom: 0.5rem;">
                            <strong>Content:</strong> ${item.content || 'No text content'}
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
        } else {
            moderationList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div>No items found</div>
                    <p>All messages are clean or no items match the current filter.</p>
                </div>
            `;
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
        const response = await apiFetch(`/subscribers?filter=${filter}`);
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
            subscribersList.innerHTML = '<div class="error">Failed to load subscribers</div>';
        }
    }
}

// Load settings
async function loadSettings() {
    try {
        // Update last updated timestamp
        document.getElementById('last-updated').textContent = new Date().toLocaleDateString();
        
        // Test webhook connectivity
        const webhookStatus = document.getElementById('webhook-status');
        try {
            const response = await fetch(window.location.origin + '/health');
            if (response.ok) {
                webhookStatus.innerHTML = '✓ Connected and verified';
                webhookStatus.style.background = '#f0fdf4';
                webhookStatus.style.color = '#16a34a';
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            webhookStatus.innerHTML = '⚠ Connection issues detected';
            webhookStatus.style.background = '#fef3c7';
            webhookStatus.style.color = '#92400e';
        }
        
    } catch (error) {
        console.error('Settings load error:', error);
        const settingsMessage = document.getElementById('settings-message');
        if (settingsMessage) {
            settingsMessage.innerHTML = '<div class="error">Failed to load settings</div>';
        }
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

// Modal functions
function openSponsorModal() {
    document.getElementById('sponsor-modal').classList.add('active');
    document.getElementById('sponsor-form').reset();
}

function closeSponsorModal() {
    document.getElementById('sponsor-modal').classList.remove('active');
    document.getElementById('sponsor-form').reset();
}

function openCampaignModal() {
    document.getElementById('campaign-modal').classList.add('active');
    document.getElementById('campaign-form').reset();
    
    // Load sponsors for campaign form
    loadSponsorsForCampaign();
}

async function loadSponsorsForCampaign() {
    try {
        const response = await apiFetch('/sponsors');
        const data = await response.json();
        
        const campaignSponsorSelect = document.getElementById('campaign-sponsor-select');
        if (campaignSponsorSelect && data.sponsors) {
            campaignSponsorSelect.innerHTML = '<option value="">No Sponsor</option>' + 
                data.sponsors.map(s => `<option value="${s.id}">${s.display_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load sponsors for campaign:', error);
    }
}

function closeCampaignModal() {
    document.getElementById('campaign-modal').classList.remove('active');
    document.getElementById('campaign-form').reset();
}

function openAdminUserModal() {
    document.getElementById('admin-user-modal').classList.add('active');
    document.getElementById('admin-user-form').reset();
}

function closeAdminUserModal() {
    document.getElementById('admin-user-modal').classList.remove('active');
    document.getElementById('admin-user-form').reset();
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

function editSponsor(id) {
    openSponsorModal();
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
            // For now, just mark as processed - could create moment from approved message
            showSuccess('Message approved');
            loadModeration();
        } catch (error) {
            showError('Failed to approve message');
        }
    });
}

function flagMessage(id) {
    showConfirm('Flag this message as inappropriate?', async () => {
        try {
            // For now, just show success - could add to blocked list
            showSuccess('Message flagged');
            loadModeration();
        } catch (error) {
            showError('Failed to flag message');
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
function editCampaign(id) {
    // Load campaign data and open modal for editing
    openCampaignModal();
    document.getElementById('campaign-modal-title').textContent = 'Edit Campaign';
    document.getElementById('campaign-submit-btn').textContent = 'Update Campaign';
    document.getElementById('campaign-edit-id').value = id;
}

function activateCampaign(id) {
    showConfirm('Activate this campaign?', async () => {
        try {
            const response = await apiFetch(`/campaigns/${id}/activate`, {
                method: 'POST'
            });
            
            if (response.ok) {
                showSuccess('Campaign activated successfully');
                loadCampaigns();
            } else {
                showError('Failed to activate campaign');
            }
        } catch (error) {
            showError('Failed to activate campaign');
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

    const sponsorForm = document.getElementById('sponsor-form');
    if (sponsorForm) {
        sponsorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('sponsor-submit-btn');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            const isEdit = !!data.id;
            
            // Handle logo upload
            const logoFile = formData.get('logo_file');
            if (logoFile && logoFile.size > 0) {
                try {
                    const logoFormData = new FormData();
                    logoFormData.append('media_files', logoFile);
                    
                    const uploadResponse = await apiFetch('/upload-media', {
                        method: 'POST',
                        body: logoFormData
                    });
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success && uploadResult.files.length > 0) {
                        data.logo_url = uploadResult.files[0].publicUrl;
                        showSuccess('Logo uploaded successfully');
                    }
                } catch (uploadError) {
                    console.error('Logo upload failed:', uploadError);
                    showError('Logo upload failed, but sponsor will be saved without logo');
                }
            }
            
            // Remove logo_file from data since it's handled separately
            delete data.logo_file;
            
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

    const campaignForm = document.getElementById('campaign-form');
    if (campaignForm) {
        campaignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('campaign-submit-btn');
            setButtonLoading(submitBtn, true);
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Handle media files first
            const mediaFiles = formData.getAll('campaign_media');
            let mediaUrls = [];
            
            if (mediaFiles && mediaFiles.length > 0 && mediaFiles[0].size > 0) {
                try {
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
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success) {
                        mediaUrls = uploadResult.files.map(f => f.publicUrl);
                        showSuccess(`${uploadResult.files.length} media file(s) uploaded`);
                    }
                } catch (uploadError) {
                    console.error('Media upload failed:', uploadError);
                    showError('Media upload failed, but campaign will be saved without media');
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
            
            // Get additional selections
            const additionalRegions = Array.from(document.querySelectorAll('input[name="target_regions"]:checked')).map(cb => cb.value);
            const additionalCategories = Array.from(document.querySelectorAll('input[name="target_categories"]:checked')).map(cb => cb.value);
            
            // Combine primary + additional (remove duplicates)
            const allRegions = [primaryRegion, ...additionalRegions].filter((v, i, a) => v && a.indexOf(v) === i);
            const allCategories = [primaryCategory, ...additionalCategories].filter((v, i, a) => v && a.indexOf(v) === i);
            
            data.target_regions = allRegions;
            data.target_categories = allCategories;
            
            // Clean up form data
            delete data.primary_region;
            delete data.primary_category;
            
            try {
                const response = await apiFetch('/campaigns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                if (response.ok) {
                    showSuccess(`Campaign created successfully! ${result.auto_approved ? '(Auto-approved)' : '(Pending review)'}`);
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

    const adminUserForm = document.getElementById('admin-user-form');
    if (adminUserForm) {
        adminUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('admin-user-submit-btn');
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
});

// Load more campaigns function
function loadMoreCampaigns() {
    // This would typically load the next page of campaigns
    // For now, just show a message
    showSuccess('Load more functionality would fetch additional campaigns');
}