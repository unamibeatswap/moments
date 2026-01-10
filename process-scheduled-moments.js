import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function processScheduledMoments() {
  console.log('🕐 PROCESSING OVERDUE SCHEDULED MOMENTS');
  console.log('═══════════════════════════════════════');

  // Get overdue scheduled moments
  const { data: scheduledMoments, error } = await supabase
    .from('moments')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());

  if (error) {
    console.error('❌ Error fetching scheduled moments:', error);
    return;
  }

  console.log(`📋 Found ${scheduledMoments?.length || 0} overdue scheduled moments`);

  if (!scheduledMoments || scheduledMoments.length === 0) {
    console.log('✅ No overdue moments to process');
    return;
  }

  let processedCount = 0;

  for (const moment of scheduledMoments) {
    console.log(`\n📝 Processing: ${moment.title}`);
    console.log(`⏰ Was scheduled for: ${moment.scheduled_at}`);

    const { error: updateError } = await supabase
      .from('moments')
      .update({
        status: 'draft',
        scheduled_at: null
      })
      .eq('id', moment.id);

    if (updateError) {
      console.error(`❌ Failed to update ${moment.id}:`, updateError);
    } else {
      console.log(`✅ Updated to draft status`);
      processedCount++;
    }
  }

  console.log(`\n🎉 PROCESSING COMPLETE`);
  console.log(`✅ Successfully processed: ${processedCount}/${scheduledMoments.length} moments`);
  console.log(`📊 These moments are now ready for broadcast in admin dashboard`);
}

processScheduledMoments();