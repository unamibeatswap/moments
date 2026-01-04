import { NextResponse } from 'next/server';

const API_BASE = process.env.RAILWAY_API_URL || 'http://localhost:8080';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    
    const response = await fetch(`${API_BASE}/admin/campaigns/${id}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'dev-token'}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Approve campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to approve campaign' },
      { status: 500 }
    );
  }
}