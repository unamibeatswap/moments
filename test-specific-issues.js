#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSpecificIssues() {
  console.log('🔍 Testing Specific Issues\n');
  
  // Issue 1: Test subscriber endpoint
  console.log('1️⃣ TESTING SUBSCRIBER ENDPOINT');
  console.log('==============================');
  
  try {
    const { data: subscribers, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('last_activity', { ascending: false });
    
    if (error) {
      console.log('❌ Subscriber query error:', error.message);
    } else {
      console.log(`✅ Subscribers query successful: ${subscribers.length} found`);
      
      // Calculate stats like the admin endpoint does
      const total = subscribers?.length || 0;
      const active = subscribers?.filter(s => s.opted_in).length || 0;
      const inactive = total - active;
      
      console.log(`   Total: ${total}, Active: ${active}, Inactive: ${inactive}`);
      
      if (subscribers.length > 0) {
        console.log('   Sample subscriber:', {
          phone: subscribers[0].phone_number,
          opted_in: subscribers[0].opted_in,
          last_activity: subscribers[0].last_activity
        });
      }
    }
  } catch (err) {
    console.log('❌ Subscriber test failed:', err.message);
  }
  
  // Issue 2: Test sponsor creation
  console.log('\n2️⃣ TESTING SPONSOR CREATION');
  console.log('============================');
  
  try {
    // Test creating a sponsor with potential duplicate name
    const testSponsor = {
      name: 'test_sponsor_debug_' + Date.now(),
      display_name: 'Test Debug Sponsor',
      contact_email: 'debug@test.com'
    };
    
    console.log('Attempting to create sponsor:', testSponsor);
    
    const { data: newSponsor, error: createError } = await supabase
      .from('sponsors')
      .insert(testSponsor)
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Sponsor creation failed:', createError.message);
      console.log('   Error code:', createError.code);
      console.log('   Error details:', createError.details);
      
      // Check if it's a unique constraint error
      if (createError.code === '23505') {
        console.log('   🔍 This is a unique constraint violation');
        
        // Check existing sponsors with similar names
        const { data: existing } = await supabase
          .from('sponsors')
          .select('name, display_name')
          .ilike('name', '%test%');
        
        console.log('   Existing test sponsors:', existing);
      }
    } else {
      console.log('✅ Sponsor creation successful:', newSponsor.id);
      
      // Clean up
      await supabase.from('sponsors').delete().eq('id', newSponsor.id);
      console.log('✅ Test sponsor cleaned up');
    }
  } catch (err) {
    console.log('❌ Sponsor creation test failed:', err.message);
  }
  
  // Issue 3: Test admin API endpoints directly
  console.log('\n3️⃣ TESTING ADMIN API ENDPOINTS');
  console.log('===============================');
  
  try {
    // Test the admin subscribers endpoint
    const subscribersUrl = `${process.env.SUPABASE_URL.replace('supabase.co', 'supabase.co')}/rest/v1/subscriptions`;
    
    const response = await fetch(subscribersUrl, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Direct API call successful, subscribers:', data.length);
    } else {
      console.log('❌ Direct API call failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('   Error response:', errorText);
    }
  } catch (err) {
    console.log('❌ Direct API test failed:', err.message);
  }
  
  // Issue 4: Check for missing unique constraints
  console.log('\n4️⃣ CHECKING SPONSOR CONSTRAINTS');
  console.log('================================');
  
  try {
    // Try to create two sponsors with the same name
    const duplicateName = 'duplicate_test_' + Date.now();
    
    const sponsor1 = {
      name: duplicateName,
      display_name: 'First Duplicate',
      contact_email: 'first@test.com'
    };
    
    const { data: first, error: firstError } = await supabase
      .from('sponsors')
      .insert(sponsor1)
      .select()
      .single();
    
    if (firstError) {
      console.log('❌ First sponsor creation failed:', firstError.message);
      return;
    }
    
    console.log('✅ First sponsor created:', first.id);
    
    // Try to create second with same name
    const sponsor2 = {
      name: duplicateName,
      display_name: 'Second Duplicate',
      contact_email: 'second@test.com'
    };
    
    const { data: second, error: secondError } = await supabase
      .from('sponsors')
      .insert(sponsor2)
      .select()
      .single();
    
    if (secondError) {
      console.log('✅ Duplicate prevention working:', secondError.message);
    } else {
      console.log('⚠️ Duplicate was allowed - constraint may be missing');
      await supabase.from('sponsors').delete().eq('id', second.id);
    }
    
    // Cleanup
    await supabase.from('sponsors').delete().eq('id', first.id);
    console.log('✅ Test sponsors cleaned up');
    
  } catch (err) {
    console.log('❌ Constraint test failed:', err.message);
  }
}

testSpecificIssues().catch(console.error);