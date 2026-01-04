'use client';

import { useState, useEffect } from 'react';

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    contact_email: ''
  });

  useEffect(() => {
    fetchSponsors();
  }, []);

  const fetchSponsors = async () => {
    try {
      const response = await fetch('/api/sponsors');
      const data = await response.json();
      setSponsors(data.sponsors || []);
    } catch (error) {
      console.error('Failed to fetch sponsors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingSponsor ? `/api/sponsors/${editingSponsor.id}` : '/api/sponsors';
      const method = editingSponsor ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchSponsors();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save sponsor:', error);
    }
  };

  const handleEdit = (sponsor) => {
    setEditingSponsor(sponsor);
    setFormData({
      name: sponsor.name,
      display_name: sponsor.display_name,
      contact_email: sponsor.contact_email || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sponsor?')) return;
    
    try {
      const response = await fetch(`/api/sponsors/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchSponsors();
      }
    } catch (error) {
      console.error('Failed to delete sponsor:', error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', display_name: '', contact_email: '' });
    setEditingSponsor(null);
    setShowForm(false);
  };

  if (loading) return <div className="loading">Loading sponsors...</div>;

  return (
    <div className="sponsors-page">
      <div className="page-header">
        <h2>Sponsor Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add Sponsor
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingSponsor ? 'Edit Sponsor' : 'Add New Sponsor'}</h3>
              <button onClick={resetForm}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Internal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g., coca_cola_sa"
                />
              </div>
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                  required
                  placeholder="e.g., Coca-Cola South Africa"
                />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  placeholder="sponsor@company.com"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingSponsor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="sponsors-grid">
        {sponsors.length === 0 ? (
          <div className="empty-state">
            <p>No sponsors yet. Add your first sponsor to get started.</p>
          </div>
        ) : (
          sponsors.map(sponsor => (
            <div key={sponsor.id} className="sponsor-card">
              <div className="sponsor-info">
                <h4>{sponsor.display_name}</h4>
                <p className="sponsor-name">ID: {sponsor.name}</p>
                {sponsor.contact_email && (
                  <p className="sponsor-email">{sponsor.contact_email}</p>
                )}
                <p className="sponsor-status">
                  Status: {sponsor.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="sponsor-actions">
                <button onClick={() => handleEdit(sponsor)}>Edit</button>
                <button 
                  onClick={() => handleDelete(sponsor.id)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .sponsors-page {
          padding: 20px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          padding: 20px;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .sponsors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .sponsor-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: white;
        }
        .sponsor-info h4 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .sponsor-name {
          color: #666;
          font-family: monospace;
          font-size: 0.9em;
        }
        .sponsor-email {
          color: #0066cc;
        }
        .sponsor-status {
          font-size: 0.9em;
          color: #666;
        }
        .sponsor-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-primary {
          background: #0066cc;
          color: white;
        }
        .btn-danger {
          background: #dc3545;
          color: white;
        }
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .loading {
          text-align: center;
          padding: 40px;
        }
      `}</style>
    </div>
  );
}