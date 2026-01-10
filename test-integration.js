#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testCompleteWorkflow() {
  console.log('🔄 Testing Complete Soft Moderation Workflow\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: End-to-End Auto-Approval Workflow
  console.log('1️⃣ Testing end-to-end auto-approval workflow...');
  try {
    // Step 1: Create a community message
    const { data: message } = await supabase
      .from('messages')
      .insert({
        whatsapp_id: 'workflow_test_' + Date.now(),
        from_number: '+27123456789',
        message_type: 'text',
        content: 'Community garden workshop this Saturday in Johannesburg. Learn organic farming techniques!',
        processed: false
      })
      .select()
      .single();
    
    console.log('   ✅ Message created:', message.id);
    
    // Step 2: Create high-confidence advisory
    const { data: advisory } = await supabase
      .from('advisories')
      .insert({
        message_id: message.id,
        advisory_type: 'content_analysis',
        confidence: 0.92,
        escalation_suggested: false,
        details: {
          language: 'en',
          sentiment: 'positive',
          categories: ['education', 'community'],
          harm_indicators: [],
          keywords: ['workshop', 'learning', 'community']
        }
      })
      .select()
      .single();
    
    console.log('   ✅ Advisory created:', advisory.id);
    
    // Step 3: Auto-approve the message
    const { data: approved } = await supabase.rpc('auto_approve_message_to_moment', {
      p_message_id: message.id
    });
    
    console.log('   ✅ Auto-approval result:', approved);
    
    // Step 4: Verify moment was created
    const { data: moment } = await supabase
      .from('moments')
      .select('*')
      .eq('content', message.content)
      .single();
    
    console.log('   ✅ Moment created:', moment.id, '- Category:', moment.category, '- Region:', moment.region);
    
    // Step 5: Verify message was marked as processed
    const { data: processedMessage } = await supabase
      .from('messages')
      .select('processed')
      .eq('id', message.id)
      .single();
    
    console.log('   ✅ Message processed:', processedMessage.processed);
    
    // Step 6: Verify flag was created
    const { data: flag } = await supabase
      .from('flags')
      .select('*')
      .eq('message_id', message.id)
      .single();
    
    console.log('   ✅ Flag created:', flag.flag_type, '- Action:', flag.action_taken);
    
    // Cleanup
    await supabase.from('flags').delete().eq('id', flag.id);
    await supabase.from('moments').delete().eq('id', moment.id);
    await supabase.from('advisories').delete().eq('id', advisory.id);
    await supabase.from('messages').delete().eq('id', message.id);
    
    testsPassed++;
  } catch (error) {
    console.log('   ❌ Workflow test failed:', error.message);
    testsFailed++;
  }
  
  // Test 2: Batch Processing Workflow
  console.log('\\n2️⃣ Testing batch processing workflow...');
  try {
    // Create multiple messages with advisories
    const messages = [];
    const advisories = [];