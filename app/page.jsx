'use client';

import { useState, useEffect } from 'react';

export default function HomePage() {
  const [stats, setStats] = useState({ moments: 0, subscribers: 0, broadcasts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Use public stats endpoint instead of admin analytics
        const res = await fetch('/api/public-stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            moments: data.totalMoments || 0,
            subscribers: data.activeSubscribers || 0,
            broadcasts: data.totalBroadcasts || 0
          });
        } else {
          // Fallback to static data if API unavailable
          setStats({ moments: 0, subscribers: 0, broadcasts: 0 });
        }
      } catch (e) {
        console.log('Stats not available, using defaults');
        setStats({ moments: 0, subscribers: 0, broadcasts: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <div className="card" style={{background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', textAlign: 'center', marginBottom: '24px'}}>
        <h1 style={{fontSize: '2rem', marginBottom: '8px', fontWeight: 700}}>🌍 Welcome to Unami Moments</h1>
        <p style={{fontSize: '1.1rem', opacity: 0.9, marginBottom: '16px'}}>100% WhatsApp-native community engagement platform for South Africa</p>
        <div style={{display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap'}}>
          <a href="/moments" className="btn" style={{background: 'rgba(255,255,255,0.2)', color: 'white', textDecoration: 'none'}}>📢 View Moments</a>
          <a href="/broadcasts" className="btn" style={{background: 'rgba(255,255,255,0.2)', color: 'white', textDecoration: 'none'}}>📡 Broadcasts</a>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px'}}>
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: '2rem', color: '#2563eb', marginBottom: '8px'}}>📢</div>
          <div style={{fontSize: '1.5rem', fontWeight: 600, color: '#1f2937'}}>{loading ? '...' : stats.moments || 0}</div>
          <div style={{color: '#6b7280', fontSize: '14px'}}>Total Moments</div>
        </div>
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: '2rem', color: '#059669', marginBottom: '8px'}}>👥</div>
          <div style={{fontSize: '1.5rem', fontWeight: 600, color: '#1f2937'}}>{loading ? '...' : stats.subscribers || 0}</div>
          <div style={{color: '#6b7280', fontSize: '14px'}}>Active Subscribers</div>
        </div>
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: '2rem', color: '#dc2626', marginBottom: '8px'}}>📡</div>
          <div style={{fontSize: '1.5rem', fontWeight: 600, color: '#1f2937'}}>{loading ? '...' : stats.broadcasts || 0}</div>
          <div style={{color: '#6b7280', fontSize: '14px'}}>Broadcasts Sent</div>
        </div>
      </div>

      {/* Features Grid */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px'}}>
        <div className="card">
          <h3 style={{color: '#1f2937', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            📢 <span>Community Moments</span>
          </h3>
          <p style={{color: '#6b7280', marginBottom: '16px', lineHeight: 1.6}}>Stay connected with your community through curated moments, local events, and important announcements delivered directly via WhatsApp.</p>
          <a href="/moments" className="btn btn-primary" style={{textDecoration: 'none'}}>Browse Moments</a>
        </div>
        
        <div className="card">
          <h3 style={{color: '#1f2937', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            📡 <span>Broadcast History</span>
          </h3>
          <p style={{color: '#6b7280', marginBottom: '16px', lineHeight: 1.6}}>View all broadcasts sent to your community, track engagement, and see what content resonates most with subscribers.</p>
          <a href="/broadcasts" className="btn btn-primary" style={{textDecoration: 'none'}}>View Broadcasts</a>
        </div>
        
        <div className="card">
          <h3 style={{color: '#1f2937', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            ⚙️ <span>Preferences</span>
          </h3>
          <p style={{color: '#6b7280', marginBottom: '16px', lineHeight: 1.6}}>Customize your experience by selecting regions, categories, and notification preferences for the content you want to receive.</p>
          <a href="/settings" className="btn btn-primary" style={{textDecoration: 'none'}}>Manage Settings</a>
        </div>
      </div>

      {/* WhatsApp Integration Info */}
      <div className="card" style={{background: '#f0fdf4', border: '1px solid #bbf7d0'}}>
        <h3 style={{color: '#166534', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
          📱 <span>WhatsApp Integration</span>
        </h3>
        <p style={{color: '#166534', marginBottom: '12px'}}>Connect with us on WhatsApp for instant community updates:</p>
        <div style={{background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #bbf7d0', marginBottom: '12px'}}>
          <strong style={{color: '#166534'}}>WhatsApp Number:</strong> <span style={{fontFamily: 'monospace', color: '#1f2937'}}>+27 65 829 5041</span>
        </div>
        <div style={{fontSize: '14px', color: '#166534'}}>
          <p><strong>Commands:</strong></p>
          <ul style={{marginLeft: '20px', marginTop: '4px'}}>
            <li><code style={{background: 'rgba(22,101,52,0.1)', padding: '2px 4px', borderRadius: '3px'}}>START</code> or <code style={{background: 'rgba(22,101,52,0.1)', padding: '2px 4px', borderRadius: '3px'}}>JOIN</code> - Opt into broadcasts</li>
            <li><code style={{background: 'rgba(22,101,52,0.1)', padding: '2px 4px', borderRadius: '3px'}}>STOP</code> or <code style={{background: 'rgba(22,101,52,0.1)', padding: '2px 4px', borderRadius: '3px'}}>UNSUBSCRIBE</code> - Opt out of broadcasts</li>
          </ul>
        </div>
      </div>

      {/* Admin Link */}
      <div style={{textAlign: 'center', marginTop: '32px', padding: '16px', background: '#f8f9fa', borderRadius: '8px'}}>
        <p style={{color: '#6c757d', marginBottom: '8px'}}>Are you an administrator?</p>
        <a href="/admin.html" className="btn" style={{background: '#6c757d', color: 'white', textDecoration: 'none'}}>Access Admin Dashboard</a>
      </div>
    </div>
  );
}
