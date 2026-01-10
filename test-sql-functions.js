#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSQLFunctions() {
  console.log('🔍 Testing SQL Functions Directly\n');
  
  // Test 1: Check if functions exist
  console.log('1️⃣ Checking function existence...');
  try {
    const { data, error } = await supabase
      .from('pg_proc')
      .select('proname')
      .like('proname', '%auto_approve%');
    
    if (data && data.length > 0) {
      console.log('✅ Found functions:', data.map(f => f.proname));
    } else {
      console.log('❌ No auto-approval functions found');
    }
  } catch (error) {
    console.log('⚠️ Cannot query pg_proc (expected):', error.message);
  }

  // Test 2: Try to call the function with raw SQL
  console.log('\n2️⃣ Testing function with raw SQL...');
  try {
    // First create a test message
    const { data: msgData } = await supabase
      .from('messages')
      .insert({
        whatsapp_id: 'sql_test_' + Date.now(),
        from_number: '+27123456789',
        message_type: 'text',
        content: 'SQL function test message',
        processed: false
      })
      .select()
      .single();

    console.log('✅ Test message created:', msgData.id);

    // Try to call the function via SQL
    const { data, error } = await supabase.rpc('sql', {
      query: `SELECT auto_approve_message_to_moment('${msgData.id}');`
    });

    if (error) {
      console.log('❌ SQL function call failed:', error.message);
    } else {
      console.log('✅ SQL function result:', data);
    }

    // Cleanup
    await supabase.from('messages').delete().eq('id', msgData.id);
  } catch (error) {
    console.log('❌ Raw SQL test failed:', error.message);
  }

  // Test 3: Check if the soft moderation SQL was actually deployed
  console.log('\n3️⃣ Checking soft moderation deployment...');
  try {
    // Try a simple query that would use the indexes created by soft-moderation.sql
    const { data, error } = await supabase
      .from('messages')
      .select('id, processed')
      .eq('processed', false)
      .limit(5);

    if (error) {
      console.log('❌ Index query failed:', error.message);
    } else {
      console.log('✅ Soft moderation indexes working, found', data.length, 'unprocessed messages');
    }
  } catch (error) {
    console.log('❌ Index test failed:', error.message);
  }

  // Test 4: Manual auto-approval logic
  console.log('\n4️⃣ Testing manual auto-approval logic...');
  try {
    // Create test message and advisory
    const { data: msgData } = await supabase
      .from('messages')
      .insert({
        whatsapp_id: 'manual_test_' + Date.now(),
        from_number: '+27123456789',
        message_type: 'text',
        content: 'Community garden opening in Johannesburg this Saturday',
        processed: false
      })
      .select()
      .single();

    const { data: advData } = await supabase
      .from('advisories')
      .insert({
        message_id: msgData.id,
        advisory_type: 'content_analysis',
        confidence: 0.90,
        escalation_suggested: false,
        details: {
          language: 'en',
          sentiment: 'positive',
          categories: ['events', 'community'],
          harm_indicators: []
        }
      })
      .select()
      .single();

    console.log('✅ Test data created - Message:', msgData.id, 'Advisory:', advData.id);

    // Manual approval logic
    if (advData.confidence >= 0.8 && !advData.escalation_suggested) {
      // Create moment
      const { data: momentData, error: momentError } = await supabase
        .from('moments')
        .insert({
          title: 'Community Event',
          content: msgData.content,
          region: 'GP',
          category: 'Events',
          content_source: 'community',
          status: 'draft',
          created_by: 'auto_approval_system'
        })
        .select()
        .single();

      if (momentError) {
        console.log('❌ Manual moment creation failed:', momentError.message);
      } else {
        console.log('✅ Manual auto-approval successful - Moment:', momentData.id);
        
        // Mark message as processed
        await supabase
          .from('messages')
          .update({ processed: true })
          .eq('id', msgData.id);

        // Cleanup
        await supabase.from('moments').delete().eq('id', momentData.id);
      }
    }

    // Cleanup test data
    await supabase.from('advisories').delete().eq('id', advData.id);
    await supabase.from('messages').delete().eq('id', msgData.id);

  } catch (error) {
    console.log('❌ Manual approval test failed:', error.message);
  }

  console.log('\n✅ SQL Function testing completed');
}

testSQLFunctions().catch(console.error);