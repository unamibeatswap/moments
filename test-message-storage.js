import { supabase } from './config/railway-db.js';

// Test message storage
const testMessageStorage = async () => {
  console.log('Testing message storage...\n');
  
  // Test 1: Check if messages table exists and can be queried
  console.log('1. Testing database connection and messages table...');
  try {
    const { data, error } = await supabase.from('messages').select('*').limit(5);
    if (error) {
      console.error('❌ Database query failed:', error.message);
      return;
    }
    console.log('✅ Database connection successful');
    console.log(`📊 Found ${data.length} existing messages`);
    if (data.length > 0) {
      console.log('Latest message:', {
        id: data[0].id,
        from: data[0].from_number,
        type: data[0].message_type,
        content: data[0].content?.substring(0, 50) + '...'
      });
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  // Test 2: Insert a test message directly
  console.log('\n2. Testing direct message insertion...');
  const testMessage = {
    whatsapp_id: 'test_' + Date.now(),
    from_number: '27123456789',
    message_type: 'text',
    content: 'Test message for storage verification',
    language_detected: 'eng',
    timestamp: new Date().toISOString(),
    processed: false
  };
  
  try {
    const { data, error } = await supabase.from('messages').insert(testMessage).select().single();
    if (error) {
      console.error('❌ Message insertion failed:', error.message);
      return;
    }
    console.log('✅ Test message inserted successfully');
    console.log('Inserted message ID:', data?.id);
  } catch (error) {
    console.error('❌ Message insertion error:', error.message);
    return;
  }
  
  // Test 3: Verify the message was stored
  console.log('\n3. Verifying message storage...');
  try {
    const { data, error } = await supabase.from('messages').select('*').limit(1);
    if (error) {
      console.error('❌ Verification query failed:', error.message);
      return;
    }
    
    const storedMessage = data.find(msg => msg.whatsapp_id === testMessage.whatsapp_id);
    if (storedMessage) {
      console.log('✅ Message successfully stored and retrieved');
      console.log('Stored message details:', {
        id: storedMessage.id,
        whatsapp_id: storedMessage.whatsapp_id,
        from_number: storedMessage.from_number,
        content: storedMessage.content,
        language_detected: storedMessage.language_detected,
        processed: storedMessage.processed
      });
    } else {
      console.log('⚠️  Message not found in recent results');
    }
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
  
  console.log('\n✅ Message storage test completed');
};

testMessageStorage().catch(console.error);