#!/usr/bin/env node

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycWVpYWR1ZHp3Ym16ZGhxa2l0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIxODU5OCwiZXhwIjoyMDgxNzk0NTk4fQ.WyolKqTVdblr1r8eCjOOaBuMq2uLAJIM_0YC3n3M7s8';
const API_BASE = 'https://arqeiadudzwbmzdhqkit.supabase.co/functions/v1/admin-api';

async function testEndpoint(path, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(`${API_BASE}${path}`, options);
        const data = await response.json();
        
        console.log(`✅ ${method} ${path}: ${response.status} - ${JSON.stringify(data).substring(0, 100)}...`);
        return { success: response.ok, data, status: response.status };
    } catch (error) {
        console.log(`❌ ${method} ${path}: ERROR - ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('🧪 Testing Admin System Endpoints\n');
    
    // Test login first
    console.log('1. Testing Login:');
    const loginResult = await testEndpoint('', 'POST', {
        email: 'info@unamifoundation.org',
        password: 'Proof321#'
    });
    
    let sessionToken = null;
    if (loginResult.success && loginResult.data.token) {
        sessionToken = loginResult.data.token;
        console.log(`   Session token: ${sessionToken}\n`);
    }
    
    // Test all admin endpoints
    console.log('2. Testing Admin Endpoints:');
    const endpoints = [
        '/analytics',
        '/moments',
        '/sponsors', 
        '/broadcasts',
        '/subscribers',
        '/moderation',
        '/campaigns',
        '/admin-users'
    ];
    
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint);
    }
    
    console.log('\n3. Testing with Session Token:');
    if (sessionToken) {
        // Test with session token
        const sessionOptions = {
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        try {
            const response = await fetch(`${API_BASE}/analytics`, sessionOptions);
            const data = await response.json();
            console.log(`   Session auth: ${response.status} - ${JSON.stringify(data).substring(0, 100)}...`);
        } catch (error) {
            console.log(`   Session auth: ERROR - ${error.message}`);
        }
    }
    
    console.log('\n🏁 Admin System Test Complete');
}

runTests().catch(console.error);