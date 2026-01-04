import { NextResponse } from 'next/server';

const API_BASE = process.env.RAILWAY_API_URL || 'http://localhost:8080';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const response = await fetch(`${API_BASE}/admin/sponsors/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'dev-token'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Update sponsor error:', error);
    return NextResponse.json(
      { error: 'Failed to update sponsor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    const response = await fetch(`${API_BASE}/admin/sponsors/${id}`, {
      method: 'DELETE',
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
    console.error('Delete sponsor error:', error);
    return NextResponse.json(
      { error: 'Failed to delete sponsor' },
      { status: 500 }
    );
  }
}