import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function convertApprovedMessage() {
  console.log('🔄 CONVERTING APPROVED MESSAGE TO MOMENT');
  
  // Get the latest unprocessed message
  const { data: message } = await supabase
    .from('messages')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!message) {
    console.log('❌ No unprocessed messages found');
    return;
  }

  console.log(`📱 Message: ${message.content.substring(0, 50)}...`);
  console.log(`📞 From: ${message.from_number}`);

  // Create moment
  const title = message.content.length > 50 
    ? message.content.substring(0, 50) + '...'
    : message.content;

  const { data: moment, error } = await supabase
    .from('moments')
    .insert({
      title: title,
      content: message.content,
      region: 'GP',
      category: 'Events', 
      content_source: 'whatsapp',
      status: 'draft',
      created_by: message.from_number
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Failed:', error);
    return;
  }

  // Mark as processed
  await supabase
    .from('messages')
    .update({ processed: true })
    .eq('id', message.id);

  console.log(`✅ Created moment: ${moment.id}`);
  console.log(`📋 Title: ${moment.title}`);
  
  // Check total WhatsApp moments
  const { data: allMoments } = await supabase
    .from('moments')
    .select('*')
    .eq('content_source', 'whatsapp')
    .order('created_at', { ascending: false });

  console.log(`\n📊 Total WhatsApp moments: ${allMoments?.length || 0}`);
}

convertApprovedMessage();