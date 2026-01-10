#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigateIssues() {
  console.log('🔍 Investigating Subscriber & Sponsor Issues\n');
  
  // 1. Check subscribers table structure and data
  console.log('1️⃣ SUBSCRIBER INVESTIGATION');
  console.log('==========================');
  
  try {
    const { data: subscribers, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(10);
    
    if (subError) {
      console.log('❌ Subscriber query error:', subError.message);
    } else {
      console.log(`📊 Subscribers found: ${subscribers.length}`);
      if (subscribers.length > 0) {
        console.log('Sample subscriber:', subscribers[0]);
      } else {
        console.log('✅ No subscribers (expected after cleanup)');
      }
    }
  } catch (err) {
    console.log('❌ Subscriber table error:', err.message);
  }
  
  // 2. Check sponsors table structure and data
  console.log('\n2️⃣ SPONSOR INVESTIGATION');
  console.log('========================');
  
  try {
    const { data: sponsors, error: sponsorError } = await supabase
      .from('sponsors')
      .select('*');
    
    if (sponsorError) {
      console.log('❌ Sponsor query error:', sponsorError.message);
    } else {
      console.log(`📊 Sponsors found: ${sponsors.length}`);
      sponsors.forEach((sponsor, i) => {
        console.log(`${i + 1}. ${sponsor.name} - ${sponsor.display_name} (${sponsor.active ? 'Active' : 'Inactive'})`);
      });
    }
  } catch (err) {
    console.log('❌ Sponsor table error:', err.message);
  }
  
  // 3. Test sponsor creation to identify submission issues
  console.log('\n3️⃣ SPONSOR SUBMISSION TEST');
  console.log('==========================');
  
  try {
    // Test creating a sponsor
    const testSponsor = {
      name: 'test_sponsor_' + Date.now(),
      display_name: 'Test Sponsor Company',
      contact_email: 'test@example.com',
      active: true
    };
    
    const { data: newSponsor, error: createError } = await supabase
      .from('sponsors')
      .insert(testSponsor)
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Sponsor creation failed:', createError.message);
      console.log('Error details:', createError);
    } else {
      console.log('✅ Sponsor creation successful:', newSponsor.id);
      
      // Clean up test sponsor
      await supabase.from('sponsors').delete().eq('id', newSponsor.id);
      console.log('✅ Test sponsor cleaned up');
    }
  } catch (err) {
    console.log('❌ Sponsor creation test error:', err.message);
  }
  
  // 4. Check for unique constraints or other issues
  console.log('\n4️⃣ CONSTRAINT INVESTIGATION');
  console.log('===========================');
  
  try {
    // Try to create duplicate sponsor names
    const duplicateTest = {
      name: 'unami_foundation', // This should already exist
      display_name: 'Duplicate Test',
      contact_email: 'duplicate@test.com'
    };
    
    const { error: dupError } = await supabase
      .from('sponsors')
      .insert(duplicateTest);
    
    if (dupError) {
      console.log('✅ Unique constraint working:', dupError.message);
    } else {
      console.log('⚠️ Duplicate sponsor created (unexpected)');
    }
  } catch (err) {
    console.log('❌ Constraint test error:', err.message);
  }
  
  // 5. Check admin dashboard endpoints
  console.log('\n5️⃣ ADMIN ENDPOINT TEST');
  console.log('======================');
  
  try {
    // Test the admin sponsors endpoint
    const response = await fetch(`${process.env.SUPABASE_URL.replace('supabase.co', 'supabase.co')}/rest/v1/sponsors`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ REST API working, sponsors:', data.length);
    } else {
      console.log('❌ REST API error:', response.status, response.statusText);
    }
  } catch (err) {
    console.log('❌ REST API test error:', err.message);
  }
}

investigateIssues().catch(console.error);