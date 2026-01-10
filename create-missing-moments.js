import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createMissingWhatsAppMoments() {
  console.log('📱 CREATING MISSING WHATSAPP MOMENTS');
  console.log('═══════════════════════════════════');

  const whatsappMoments = [
    {
      title: 'Community garden project starting in Johannesburg this Saturday',
      content: 'Community garden project starting in Johannesburg this Saturday. Free vegetables for families in need. Volunteers welcome!',
      from_number: '+27821234567'
    },
    {
      title: 'New tech workshop for youth in Cape Town',
      content: 'New tech workshop for youth in Cape Town next week. Learn coding and digital skills. Registration open now!',
      from_number: '+27821234567'
    }
  ];

  for (const momentData of whatsappMoments) {
    console.log(`\n📝 Creating: ${momentData.title}`);
    
    try {
      const { data: moment, error } = await supabase
        .from('moments')
        .insert({
          title: momentData.title,
          content: momentData.content,
          region: 'GP',
          category: 'Events',
          content_source: 'whatsapp',
          status: 'draft',
          created_by: momentData.from_number,
          media_urls: []
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed:', error.message);
      } else {
        console.log(`✅ Created moment: ${moment.id}`);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n📊 CHECKING ADMIN DASHBOARD VISIBILITY');
  
  // Check if moments are visible in admin
  const { data: adminMoments } = await supabase
    .from('moments')
    .select('*')
    .eq('content_source', 'whatsapp')
    .order('created_at', { ascending: false });

  console.log(`✅ WhatsApp moments in admin: ${adminMoments?.length || 0}`);
  
  adminMoments?.forEach(moment => {
    console.log(`• ${moment.title} (${moment.status})`);
  });

  console.log('\n🎉 MISSING MOMENTS CREATED');
}

createMissingWhatsAppMoments();