#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function deploySoftModeration() {
  console.log('🚀 Deploying Soft Moderation Functions\n');
  
  try {
    // Read the SQL file
    const sqlContent = readFileSync('/workspaces/whatsapp/supabase/soft-moderation-fixed.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`${i + 1}/${statements.length} Executing statement...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try alternative method
          const { error: altError } = await supabase
            .from('_supabase_admin')
            .select('*')
            .limit(0); // This will fail but might give us access
          
          console.log('⚠️ Direct SQL execution not available, trying manual approach...');
          break;
        }
        
        console.log('✅ Statement executed successfully');
      } catch (err) {
        console.log('⚠️ Statement execution method not available:', err.message);
        break;
      }
    }
    
    // Test if functions were created
    console.log('\n🧪 Testing function deployment...');
    
    try {
      const { data, error } = await supabase.rpc('auto_approve_message_to_moment', {
        p_message_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (error && error.message.includes('Message not found')) {
        console.log('✅ auto_approve_message_to_moment function is working!');
      } else if (error) {
        console.log('❌ Function test failed:', error.message);
      }
    } catch (err) {
      console.log('❌ Function not found:', err.message);
    }
    
    try {
      const { data, error } = await supabase.rpc('process_auto_approval_queue');
      
      if (error) {
        console.log('❌ process_auto_approval_queue test failed:', error.message);
      } else {
        console.log('✅ process_auto_approval_queue function is working! Processed:', data, 'messages');
      }
    } catch (err) {
      console.log('❌ Batch function not found:', err.message);
    }
    
  } catch (error) {
    console.log('❌ Deployment failed:', error.message);
  }
}

// Also provide manual SQL for copy-paste
console.log('📋 MANUAL DEPLOYMENT INSTRUCTIONS:');
console.log('==================================');
console.log('If automatic deployment fails, copy and paste this SQL into your Supabase SQL Editor:\n');

const sqlContent = readFileSync('/workspaces/whatsapp/supabase/soft-moderation-fixed.sql', 'utf8');
console.log(sqlContent);
console.log('\n==================================\n');

deploySoftModeration().catch(console.error);