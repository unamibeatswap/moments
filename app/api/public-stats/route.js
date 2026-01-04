import { NextResponse } from 'next/server';

const API_BASE = process.env.RAILWAY_API_URL || 'http://localhost:8080';

export async function GET() {
  try {
    // Try to get public stats from backend
    const response = await fetch(`${API_BASE}/public/stats`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Return default stats if backend unavailable
      return NextResponse.json({
        totalMoments: 0,
        activeSubscribers: 0,
        totalBroadcasts: 0,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Public stats error:', error);
    // Return default stats on error
    return NextResponse.json({
      totalMoments: 0,
      activeSubscribers: 0,
      totalBroadcasts: 0,
      lastUpdated: new Date().toISOString()
    });
  }
}