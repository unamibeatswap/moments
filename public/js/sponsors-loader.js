// Quick fix: Load sponsors when section is shown
(function() {
    const originalShowSection = window.showSection;
    window.showSection = function(sectionId) {
        originalShowSection(sectionId);
        if (sectionId === 'sponsors') {
            loadSponsorsData();
        }
    };
    
    async function loadSponsorsData() {
        const container = document.getElementById('sponsors-list');
        if (!container) return;
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/sponsors`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('admin.auth.token')}` }
            });
            const data = await response.json();
            
            if (data.sponsors && data.sponsors.length > 0) {
                container.innerHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Display Name</th>
                                <th>Contact</th>
                                <th>Tier</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.sponsors.map(s => `
                                <tr>
                                    <td>${s.name}</td>
                                    <td>${s.display_name}</td>
                                    <td>${s.contact_email || '-'}</td>
                                    <td>${s.tier || 'bronze'}</td>
                                    <td>${s.active ? '✅ Active' : '❌ Inactive'}</td>
                                    <td>
                                        <button class="btn btn-sm" onclick="editSponsor('${s.id}')">Edit</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                container.innerHTML = '<p>No sponsors found. <button class="btn" data-action="new-sponsor">Add First Sponsor</button></p>';
            }
        } catch (error) {
            console.error('Failed to load sponsors:', error);
            container.innerHTML = '<p class="error">Failed to load sponsors. Please refresh.</p>';
        }
    }
    
    window.editSponsor = function(id) {
        console.log('Edit sponsor:', id);
        // TODO: Implement edit
    };
    
    // Load on page load if sponsors section is active
    if (document.getElementById('sponsors')?.classList.contains('active')) {
        loadSponsorsData();
    }
})();
