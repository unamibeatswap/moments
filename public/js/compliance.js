// Meta WhatsApp Business API Compliance Integration
let complianceCategories = [];

// Load compliance categories on page load
async function loadComplianceCategories() {
    try {
        const response = await fetch('/supabase/functions/v1/admin-api/compliance/categories', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin.auth.token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            complianceCategories = data.categories || [];
            populateCategoryDropdowns();
        }
    } catch (error) {
        console.warn('Failed to load compliance categories:', error);
    }
}

// Populate category dropdowns with compliance data
function populateCategoryDropdowns() {
    const selects = document.querySelectorAll('#campaign-category-select, #campaignCategory');
    
    selects.forEach(select => {
        if (!select) return;
        
        // Clear existing options except first
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Group categories by type
        const allowed = complianceCategories.filter(cat => cat.category_type === 'ALLOWED');
        const restricted = complianceCategories.filter(cat => cat.category_type === 'RESTRICTED');
        
        // Add allowed categories
        if (allowed.length > 0) {
            const allowedGroup = document.createElement('optgroup');
            allowedGroup.label = '✅ Safe Categories (Low Risk)';
            allowed.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.category_name;
                option.textContent = `${getRiskIcon(cat.risk_level)} ${cat.category_name}`;
                allowedGroup.appendChild(option);
            });
            select.appendChild(allowedGroup);
        }
        
        // Add restricted categories
        if (restricted.length > 0) {
            const restrictedGroup = document.createElement('optgroup');
            restrictedGroup.label = '⚠️ Restricted Categories (Requires Approval)';
            restricted.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.category_name;
                option.textContent = `${getRiskIcon(cat.risk_level)} ${cat.category_name}`;
                restrictedGroup.appendChild(option);
            });
            select.appendChild(restrictedGroup);
        }
        
        // Add change listener for risk indicators
        select.addEventListener('change', showCategoryRisk);
    });
}

// Get risk icon based on level
function getRiskIcon(riskLevel) {
    switch (riskLevel) {
        case 'LOW': return '🟢';
        case 'MEDIUM': return '🟡';
        case 'HIGH': return '🟠';
        case 'CRITICAL': return '🔴';
        default: return '⚪';
    }
}

// Show category risk indicator
function showCategoryRisk(event) {
    const selectedCategory = event.target.value;
    const category = complianceCategories.find(cat => cat.category_name === selectedCategory);
    
    const riskIndicator = document.getElementById('categoryRisk');
    const complianceWarning = document.getElementById('complianceWarning');
    
    if (!category) {
        if (riskIndicator) riskIndicator.style.display = 'none';
        if (complianceWarning) complianceWarning.style.display = 'none';
        return;
    }
    
    // Show risk indicator
    if (riskIndicator) {
        riskIndicator.className = `risk-indicator risk-${category.risk_level.toLowerCase()}`;
        riskIndicator.textContent = `${getRiskIcon(category.risk_level)} ${category.risk_level} RISK - ${category.description}`;
        riskIndicator.style.display = 'block';
    }
    
    // Show compliance warning for restricted categories
    if (complianceWarning) {
        if (category.category_type === 'RESTRICTED' || category.requires_approval) {
            complianceWarning.innerHTML = `
                <strong>⚠️ Approval Required:</strong> This category requires admin approval before broadcasting.
                Content will be reviewed for Meta policy compliance.
            `;
            complianceWarning.style.display = 'block';
        } else {
            complianceWarning.style.display = 'none';
        }
    }
}

// Check campaign compliance in real-time
async function checkCampaignCompliance(title, content, category) {
    try {
        const response = await fetch('/supabase/functions/v1/admin-api/compliance/check', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin.auth.token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title || '',
                content: content || '',
                category: category || ''
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.compliance;
        }
    } catch (error) {
        console.warn('Compliance check failed:', error);
    }
    
    return null;
}

// Show compliance results
function showComplianceResults(compliance, targetElement) {
    if (!compliance || !targetElement) return;
    
    const riskClass = compliance.risk_score >= 90 ? 'critical' : 
                     compliance.risk_score >= 70 ? 'high' :
                     compliance.risk_score >= 40 ? 'medium' : 'low';
    
    let html = `
        <div class="compliance-result risk-${riskClass}">
            <div class="compliance-header">
                <span class="risk-badge">${compliance.violation_severity}</span>
                <span class="risk-score">Risk Score: ${compliance.risk_score}/100</span>
            </div>
            <div class="compliance-recommendation">
                ${compliance.recommendation}
            </div>
    `;
    
    if (compliance.violations && compliance.violations.length > 0) {
        html += `
            <div class="compliance-violations">
                <strong>Issues Found:</strong>
                <ul>
                    ${compliance.violations.map(v => `<li>${v}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    html += '</div>';
    targetElement.innerHTML = html;
}

// Add compliance check to campaign form
function addComplianceToForm() {
    const campaignForm = document.getElementById('campaign-form');
    if (!campaignForm) return;
    
    // Add compliance check container
    const complianceContainer = document.createElement('div');
    complianceContainer.id = 'compliance-check-container';
    complianceContainer.innerHTML = `
        <div class="form-group">
            <label>Meta Compliance Check</label>
            <div id="compliance-results" style="min-height: 40px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; background: #f9fafb;">
                <em>Enter title, content, and category to check compliance...</em>
            </div>
            <button type="button" id="run-compliance-check" class="btn btn-sm" style="margin-top: 8px;">
                🔍 Check Compliance
            </button>
        </div>
    `;
    
    // Insert before submit buttons
    const submitContainer = campaignForm.querySelector('[style*="justify-content: flex-end"]');
    if (submitContainer) {
        campaignForm.insertBefore(complianceContainer, submitContainer);
    }
    
    // Add compliance check button handler
    document.getElementById('run-compliance-check').addEventListener('click', async () => {
        const title = campaignForm.querySelector('[name="title"]').value;
        const content = campaignForm.querySelector('[name="content"]').value;
        const category = campaignForm.querySelector('[name="primary_category"]').value;
        
        if (!title && !content && !category) {
            document.getElementById('compliance-results').innerHTML = 
                '<em style="color: #6b7280;">Please enter title, content, and category first.</em>';
            return;
        }
        
        document.getElementById('compliance-results').innerHTML = 
            '<div style="color: #6b7280;">🔍 Checking compliance...</div>';
        
        const compliance = await checkCampaignCompliance(title, content, category);
        if (compliance) {
            showComplianceResults(compliance, document.getElementById('compliance-results'));
            
            // Disable submit if non-compliant
            const submitBtn = document.getElementById('campaign-submit-btn');
            if (submitBtn) {
                if (!compliance.is_compliant && compliance.violation_severity === 'SUSPEND') {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '❌ Cannot Send - Policy Violation';
                    submitBtn.className = 'btn btn-danger';
                } else {
                    submitBtn.disabled = false;
                    submitBtn.textContent = compliance.requires_approval ? 
                        '⚠️ Submit for Approval' : 'Create Campaign';
                    submitBtn.className = 'btn';
                }
            }
        } else {
            document.getElementById('compliance-results').innerHTML = 
                '<div style="color: #dc2626;">❌ Compliance check failed. Please try again.</div>';
        }
    });
}

// Initialize compliance system
document.addEventListener('DOMContentLoaded', () => {
    loadComplianceCategories();
    
    // Add compliance to campaign modal when it opens
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const modal = document.getElementById('campaign-modal');
                if (modal && modal.classList.contains('active')) {
                    setTimeout(addComplianceToForm, 100);
                }
            }
        });
    });
    
    const campaignModal = document.getElementById('campaign-modal');
    if (campaignModal) {
        observer.observe(campaignModal, { attributes: true });
    }
});