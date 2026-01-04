'use client';

import { useState, useEffect } from 'react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    sponsor_id: '',
    budget: 0,
    target_regions: [],
    target_categories: [],
    scheduled_at: ''
  });

  const regions = ['KZN', 'WC', 'GP', 'EC', 'FS', 'LP', 'MP', 'NC', 'NW'];
  const categories = ['Education', 'Safety', 'Culture', 'Opportunity', 'Events', 'Health', 'Technology'];

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const [campaignsRes, sponsorsRes] = await Promise.all([
        fetch(`/api/campaigns?status=${filter === 'all' ? '' : filter}`),
        fetch('/api/sponsors')
      ]);
      
      const campaignsData = await campaignsRes.json();
      const sponsorsData = await sponsorsRes.json();
      
      setCampaigns(campaignsData.campaigns || []);
      setSponsors(sponsorsData.sponsors || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchData();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`/api/campaigns/${id}/approve`, {
        method: 'POST'
      });
      if (response.ok) await fetchData();
    } catch (error) {
      console.error('Failed to approve campaign:', error);
    }
  };

  const handlePublish = async (id) => {
    if (!confirm('Publish this campaign? This will create a moment and broadcast immediately.')) return;
    
    try {
      const response = await fetch(`/api/campaigns/${id}/publish`, {
        method: 'POST'
      });
      if (response.ok) await fetchData();
    } catch (error) {
      console.error('Failed to publish campaign:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      sponsor_id: '',
      budget: 0,
      target_regions: [],
      target_categories: [],
      scheduled_at: ''
    });
    setShowForm(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending_review: '#ffc107',
      approved: '#28a745',
      published: '#17a2b8',
      rejected: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  if (loading) return <div className="loading">Loading campaigns...</div>;

  return (
    <div className="campaigns-page">
      <div className="page-header">
        <h2>Campaign Management</h2>
        <div className="header-actions">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Campaigns</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            Create Campaign
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal campaign-modal">
            <div className="modal-header">
              <h3>Create New Campaign</h3>
              <button onClick={resetForm}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Campaign Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Campaign title"
                  />
                </div>
                <div className="form-group">
                  <label>Sponsor</label>
                  <select
                    value={formData.sponsor_id}
                    onChange={(e) => setFormData({...formData, sponsor_id: e.target.value})}
                  >
                    <option value="">Select Sponsor</option>
                    {sponsors.map(sponsor => (
                      <option key={sponsor.id} value={sponsor.id}>
                        {sponsor.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Content *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  required
                  rows="4"
                  placeholder="Campaign content..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Regions</label>
                  <div className="checkbox-group">
                    {regions.map(region => (
                      <label key={region} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.target_regions.includes(region)}
                          onChange={(e) => {
                            const regions = e.target.checked 
                              ? [...formData.target_regions, region]
                              : formData.target_regions.filter(r => r !== region);
                            setFormData({...formData, target_regions: regions});
                          }}
                        />
                        {region}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Target Categories</label>
                  <div className="checkbox-group">
                    {categories.map(category => (
                      <label key={category} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.target_categories.includes(category)}
                          onChange={(e) => {
                            const cats = e.target.checked 
                              ? [...formData.target_categories, category]
                              : formData.target_categories.filter(c => c !== category);
                            setFormData({...formData, target_categories: cats});
                          }}
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Budget (ZAR)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Scheduled For</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({...formData, scheduled_at: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="campaigns-list">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <p>No campaigns found. Create your first campaign to get started.</p>
          </div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-header">
                <h4>{campaign.title}</h4>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(campaign.status) }}
                >
                  {campaign.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="campaign-content">
                <p>{campaign.content}</p>
              </div>

              <div className="campaign-meta">
                <div className="meta-item">
                  <strong>Budget:</strong> R{campaign.budget || 0}
                </div>
                <div className="meta-item">
                  <strong>Regions:</strong> {campaign.target_regions?.join(', ') || 'All'}
                </div>
                <div className="meta-item">
                  <strong>Categories:</strong> {campaign.target_categories?.join(', ') || 'All'}
                </div>
                {campaign.scheduled_at && (
                  <div className="meta-item">
                    <strong>Scheduled:</strong> {new Date(campaign.scheduled_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="campaign-actions">
                {campaign.status === 'pending_review' && (
                  <button 
                    onClick={() => handleApprove(campaign.id)}
                    className="btn btn-success"
                  >
                    Approve
                  </button>
                )}
                {campaign.status === 'approved' && (
                  <button 
                    onClick={() => handlePublish(campaign.id)}
                    className="btn btn-primary"
                  >
                    Publish & Broadcast
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .campaigns-page {
          padding: 20px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .header-actions {
          display: flex;
          gap: 15px;
          align-items: center;
        }
        .filter-select {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .campaign-modal {
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .checkbox-group {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 5px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.9em;
        }
        .campaigns-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .campaign-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: white;
        }
        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 0.8em;
          text-transform: uppercase;
          font-weight: bold;
        }
        .campaign-content {
          margin-bottom: 15px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .campaign-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          margin-bottom: 15px;
          font-size: 0.9em;
        }
        .campaign-actions {
          display: flex;
          gap: 10px;
        }
        .btn-success {
          background: #28a745;
          color: white;
        }
      `}</style>
    </div>
  );
}