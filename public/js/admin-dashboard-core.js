// Admin Dashboard Core - Enhanced with validation, error handling, and performance monitoring

// Performance Monitoring
const perf = {
    marks: {},
    mark(name) {
        this.marks[name] = performance.now();
        performance.mark(name);
    },
    measure(name, startMark) {
        const duration = performance.now() - (this.marks[startMark] || 0);
        console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
        return duration;
    }
};

// Enhanced Error Handling
const errorMessages = {
    'NETWORK_ERROR': 'Connection lost. Please check your internet.',
    'AUTH_ERROR': 'Session expired. Please log in again.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'PERMISSION_ERROR': 'You don\'t have permission for this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'SERVER_ERROR': 'Server error. Please try again later.',
    'TIMEOUT': 'Request timed out. Please try again.'
};

function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let userMessage = 'Something went wrong. Please try again.';
    
    if (error.message && errorMessages[error.message]) {
        userMessage = errorMessages[error.message];
    } else if (error.status === 401) {
        userMessage = errorMessages.AUTH_ERROR;
        setTimeout(() => window.location.href = '/login', 2000);
    } else if (error.status === 403) {
        userMessage = errorMessages.PERMISSION_ERROR;
    } else if (error.status === 404) {
        userMessage = errorMessages.NOT_FOUND;
    } else if (error.status >= 500) {
        userMessage = errorMessages.SERVER_ERROR;
    } else if (error.message) {
        userMessage = error.message;
    }
    
    showNotification(userMessage, 'error');
    
    // Log to monitoring (if available)
    if (window.logError) {
        window.logError(error, context);
    }
}

// Form Validation
const validators = {
    required: (value) => value && value.trim().length > 0,
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    phone: (value) => /^\+?[1-9]\d{1,14}$/.test(value),
    url: (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },
    minLength: (value, min) => value && value.length >= min,
    maxLength: (value, max) => value && value.length <= max,
    number: (value) => !isNaN(parseFloat(value)) && isFinite(value)
};

function validateField(field) {
    // Skip validation for file inputs and hidden fields
    if (field.type === 'file' || field.type === 'hidden') {
        return true;
    }
    
    const value = field.value.trim();
    const type = field.type;
    const required = field.required;
    
    // Clear previous errors
    field.classList.remove('error');
    const errorEl = field.parentElement.querySelector('.field-error');
    if (errorEl) errorEl.classList.remove('active');
    
    // Required check
    if (required && !validators.required(value)) {
        showFieldError(field, 'This field is required');
        return false;
    }
    
    // Type-specific validation
    if (value) {
        if (type === 'email' && !validators.email(value)) {
            showFieldError(field, 'Please enter a valid email address');
            return false;
        }
        if (type === 'tel' && !validators.phone(value)) {
            showFieldError(field, 'Please enter a valid phone number');
            return false;
        }
        if (type === 'url' && !validators.url(value)) {
            showFieldError(field, 'Please enter a valid URL');
            return false;
        }
        if (field.minLength && !validators.minLength(value, field.minLength)) {
            showFieldError(field, `Minimum ${field.minLength} characters required`);
            return false;
        }
        if (field.maxLength && field.maxLength > 0 && !validators.maxLength(value, field.maxLength)) {
            showFieldError(field, `Maximum ${field.maxLength} characters allowed`);
            return false;
        }
    }
    
    return true;
}

function showFieldError(field, message) {
    field.classList.add('error');
    let errorEl = field.parentElement.querySelector('.field-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        field.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.classList.add('active');
}

function hideFieldError(field) {
    field.classList.remove('error');
    const errorEl = field.parentElement.querySelector('.field-error');
    if (errorEl) errorEl.classList.remove('active');
}

// Real-time validation setup
function setupFormValidation(form) {
    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
        // Validate on blur
        field.addEventListener('blur', () => validateField(field));
        
        // Clear error on input
        field.addEventListener('input', () => {
            if (field.classList.contains('error')) {
                hideFieldError(field);
            }
        });
    });
    
    // Validate all on submit
    form.addEventListener('submit', (e) => {
        let isValid = true;
        fields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            e.preventDefault();
            showNotification('Please fix the errors in the form', 'error');
        }
    });
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Search with debouncing
function setupSearch(inputId, searchFunction) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const debouncedSearch = debounce((query) => {
        perf.mark('search-start');
        searchFunction(query);
        perf.measure('Search', 'search-start');
    }, 300);
    
    input.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}

// Skeleton Loaders
function showSkeleton(containerId, type = 'card', count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const skeletons = {
        card: `<div class="skeleton skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line medium"></div>
            <div class="skeleton skeleton-line short"></div>
        </div>`,
        stat: `<div class="stat-card">
            <div class="skeleton skeleton-stat"></div>
            <div class="skeleton skeleton-text short" style="margin: 0 auto;"></div>
        </div>`,
        list: `<div class="moment-item">
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line medium"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>`
    };
    
    container.innerHTML = Array(count).fill(skeletons[type] || skeletons.card).join('');
}

// Enhanced Empty States
function showEmptyState(containerId, config) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { icon = '📭', title = 'No items found', message = '', action = null } = config;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h3>${title}</h3>
            ${message ? `<p>${message}</p>` : ''}
            ${action ? `<button class="btn" onclick="${action.handler}">${action.label}</button>` : ''}
        </div>
    `;
}

// Lazy Load Charts
function setupLazyCharts() {
    const chartContainers = document.querySelectorAll('canvas[id$="Chart"]');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const chartId = entry.target.id;
                loadChart(chartId);
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '50px' });
    
    chartContainers.forEach(canvas => observer.observe(canvas));
}

function loadChart(chartId) {
    // Chart loading logic will be handled by analytics.js
    console.log(`Loading chart: ${chartId}`);
}

// Button state management
function setButtonLoading(btn, loading = true) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = btn.textContent.replace(/🔄|✏️|\+|←|➕/g, '').trim();
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
            delete btn.dataset.originalText;
        }
    }
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = type;
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1001; padding: 1rem; border-radius: 0.5rem; animation: slideIn 0.3s ease; max-width: 400px;';
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Section navigation
function showSection(sectionId) {
    perf.mark('section-switch-start');
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    perf.measure('Section Switch', 'section-switch-start');
}

// Action handler
function handleAction(action, btn, event) {
    const actions = {
        'create-authority': () => {
            document.getElementById('authority-form')?.reset();
            document.getElementById('authority-edit-id').value = '';
            document.getElementById('authority-form-title').textContent = 'Assign Authority';
            document.getElementById('authority-submit-btn').textContent = 'Assign Authority';
            showSection('authority-form-section');
        },
        'close-authority-form': () => showSection('authority'),
        'reset-authority-form': () => {
            document.getElementById('authority-form')?.reset();
            document.getElementById('authority-edit-id').value = '';
        },
        'create-moment': () => showSection('create'),
        'create-campaign': () => showSection('campaign-form-section'),
        'close-campaign-form': () => showSection('campaigns'),
        'new-sponsor': () => showSection('sponsor-form-section'),
        'close-sponsor-form': () => showSection('sponsors'),
        'new-admin-user': () => showSection('admin-user-form-section'),
        'close-admin-user-form': () => showSection('users'),
        'back-to-moments': () => showSection('moments'),
        'reset-form': () => document.getElementById('create-form')?.reset(),
        'reset-campaign-form': () => document.getElementById('campaign-form-inline')?.reset(),
        'reset-sponsor-form': () => document.getElementById('sponsor-form-inline')?.reset(),
        'reset-admin-user-form': () => document.getElementById('admin-user-form-inline')?.reset()
    };
    
    if (actions[action]) {
        actions[action]();
    } else {
        console.log('Unhandled action:', action);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    perf.mark('dashboard-init-start');
    
    // Show page immediately
    document.body.style.opacity = '1';
    
    // Setup form validation for all forms
    document.querySelectorAll('form').forEach(form => setupFormValidation(form));
    
    // Setup lazy chart loading
    if (typeof IntersectionObserver !== 'undefined') {
        setupLazyCharts();
    }
    
    // Event delegation for better performance
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        // Immediate visual feedback
        if (!btn.disabled && !btn.classList.contains('loading')) {
            btn.style.transform = 'translateY(0) scale(0.98)';
            setTimeout(() => btn.style.transform = '', 100);
        }
        
        // Handle specific actions
        const action = btn.dataset.action;
        if (action) {
            e.preventDefault();
            e.stopPropagation();
            handleAction(action, btn, e);
        }
    }, true);
    
    // Mobile navigation toggle
    const navToggle = document.getElementById('top-nav-toggle');
    const navLinks = document.getElementById('top-nav-links');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
    }
    
    // Close mobile nav when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.top-nav') && navLinks) {
            navLinks.classList.remove('active');
        }
    });
    
    perf.measure('Dashboard Init', 'dashboard-init-start');
    performance.mark('dashboard-loaded');
});

// Pagination utility
function createPagination(containerId, totalItems, itemsPerPage, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<button class="page-btn" data-page="prev" ' + (currentPage === 1 ? 'disabled' : '') + '>←</button>';
    
    // Show first page
    if (currentPage > 3) {
        html += '<button class="page-btn" data-page="1">1</button>';
        if (currentPage > 4) html += '<span class="page-info">...</span>';
    }
    
    // Show pages around current
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    // Show last page
    if (currentPage < totalPages - 2) {
        if (currentPage < totalPages - 3) html += '<span class="page-info">...</span>';
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    html += '<button class="page-btn" data-page="next" ' + (currentPage === totalPages ? 'disabled' : '') + '>→</button>';
    html += `<span class="page-info">${currentPage} / ${totalPages}</span>`;
    
    container.innerHTML = html;
    
    // Add click handlers
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            let newPage = currentPage;
            
            if (page === 'prev') newPage = Math.max(1, currentPage - 1);
            else if (page === 'next') newPage = Math.min(totalPages, currentPage + 1);
            else newPage = parseInt(page);
            
            if (newPage !== currentPage) onPageChange(newPage);
        });
    });
}

// Export utilities for use in other modules
window.dashboardCore = {
    perf,
    handleError,
    validateField,
    showFieldError,
    hideFieldError,
    debounce,
    setupSearch,
    showSkeleton,
    showEmptyState,
    setButtonLoading,
    showNotification,
    showSection,
    handleAction,
    createPagination
};
