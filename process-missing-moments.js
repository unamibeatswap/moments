import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function processUnprocessedMessages() {
  console.log('🔄 PROCESSING UNPROCESSED MESSAGES');
  console.log('═══════════════════════════════════');

  // Get unprocessed messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log(`Found ${messages.length} unprocessed messages`);

  for (const message of messages) {
    console.log(`\n📱 Processing: ${message.content.substring(0, 50)}...`);
    console.log(`From: ${message.from_number}`);
    console.log(`Length: ${message.content.length} characters`);

    // Check if content is meaningful (not a command or casual message)
    const content = message.content;
    const isCommand = ['start', 'stop', 'help', 'regions', 'join', 'unsubscribe'].includes(content.toLowerCase().trim());
    const isCasual = ['hi', 'hey', 'hello', 'hola', 'howzit', 'sawubona'].some(pattern => content.toLowerCase().includes(pattern));
    const isGeneric = ['[Image]', '[Audio message]', '[Video]', '[Document]'].includes(content);

    if (content && content.length > 10 && !isCommand && !isCasual && !isGeneric) {
      console.log('✅ Creating moment from this message...');
      
      // Generate title
      const words = content.split(' ').slice(0, 8);
      const title = words.join(' ') + (content.split(' ').length > 8 ? '...' : '');

      try {
        const { data: moment, error: momentError } = await supabase
          .from('moments')
          .insert({
            title: title,
            content: content,
            region: 'National',
            category: 'Events',
            content_source: 'whatsapp',
            status: 'draft',
            created_by: message.from_number,
            media_urls: []
          })
          .select()
          .single();

        if (momentError) {
          console.error('❌ Moment creation failed:', momentError);
        } else {
          console.log(`✅ Created moment: ${moment.id}`);
          console.log(`   Title: ${moment.title}`);
        }
      } catch (error) {
        console.error('❌ Error creating moment:', error);
      }
    } else {
      console.log('⏭️ Skipping (command/casual/generic/too short)');
    }

    // Mark message as processed
    await supabase
      .from('messages')
      .update({ processed: true })
      .eq('id', message.id);

    console.log('✅ Marked as processed');
  }

  console.log('\n🎉 PROCESSING COMPLETE');
  
  // Show updated moments count
  const { data: allMoments } = await supabase
    .from('moments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📊 LATEST MOMENTS:');
  allMoments?.forEach(moment => {
    console.log(`• ${moment.title} (${moment.content_source}, ${moment.status})`);
  });
}

processUnprocessedMessages();