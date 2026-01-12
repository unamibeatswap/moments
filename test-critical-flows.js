import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testCriticalFlows() {
  console.log('🧪 Testing Critical Flows...');
  console.log('============================');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Database Connection
  console.log('\n1️⃣ Testing database connection...');
  try {
    const { data, error } = await supabase.from('messages').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Database connection working');
    passed++;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    failed++;
  }
  
  // Test 2: Subscription Table Structure
  console.log('\n2️⃣ Testing subscription table...');
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('phone_number, opted_in, regions')
      .limit(1);
    if (error) throw error;
    console.log('✅ Subscription table accessible');
    passed++;
  } catch (error) {
    console.log('❌ Subscription table issue:', error.message);
    failed++;
  }
  
  // Test 3: Messages Table with Moderation
  console.log('\n3️⃣ Testing messages table with moderation...');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, moderation_status')
      .limit(1);
    if (error) throw error;
    console.log('✅ Messages table with moderation ready');
    passed++;
  } catch (error) {
    console.log('❌ Messages moderation not ready:', error.message);
    failed++;
  }
  
  // Test 4: Environment Variables
  console.log('\n4️⃣ Testing environment variables...');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY', 
    'WHATSAPP_TOKEN',
    'WEBHOOK_VERIFY_TOKEN'
  ];
  
  let envPassed = 0;
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`✅ ${varName} configured`);
      envPassed++;
    } else {
      console.log(`❌ ${varName} missing`);
    }
  }
  
  if (envPassed === requiredVars.length) {
    console.log('✅ All required environment variables present');
    passed++;
  } else {
    console.log(`❌ Missing ${requiredVars.length - envPassed} environment variables`);
    failed++;
  }
  
  // Test 5: Create Test Subscription
  console.log('\n5️⃣ Testing subscription upsert...');
  try {
    const testPhone = '+27123456789';
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        phone_number: testPhone,
        opted_in: true,
        opted_in_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        regions: ['Test']
      }, { 
        onConflict: 'phone_number',
        ignoreDuplicates: false 
      });
    
    if (error) throw error;
    
    // Cleanup
    await supabase.from('subscriptions').delete().eq('phone_number', testPhone);
    
    console.log('✅ Subscription upsert working');
    passed++;
  } catch (error) {
    console.log('❌ Subscription upsert failed:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n📊 TEST RESULTS');
  console.log('================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL CRITICAL FLOWS WORKING!');
    console.log('Ready for deployment.');
  } else {
    console.log('\n⚠️ ISSUES DETECTED');
    console.log('Address failed tests before deployment.');
  }
  
  return failed === 0;
}

testCriticalFlows().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});