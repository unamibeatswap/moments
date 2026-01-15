#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeBroadcastPerformance(broadcastId) {
  try {
    console.log('📊 Analyzing broadcast performance...\n');
    
    // Get broadcast details
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .single();
    
    if (!broadcast) {
      console.error('❌ Broadcast not found');
      return;
    }
    
    // Get batch details
    const { data: batches } = await supabase
      .from('broadcast_batches')
      .select('*')
      .eq('broadcast_id', broadcastId)
      .order('batch_number');
    
    // Calculate metrics
    const startTime = new Date(broadcast.broadcast_started_at);
    const endTime = broadcast.broadcast_completed_at 
      ? new Date(broadcast.broadcast_completed_at)
      : new Date();
    
    const durationSeconds = (endTime - startTime) / 1000;
    const messagesPerSecond = broadcast.success_count / durationSeconds;
    const successRate = (broadcast.success_count / broadcast.recipient_count) * 100;
    
    console.log('📈 Overall Performance:');
    console.log(`   Status: ${broadcast.status}`);
    console.log(`   Duration: ${durationSeconds.toFixed(1)}s`);
    console.log(`   Recipients: ${broadcast.recipient_count}`);
    console.log(`   Success: ${broadcast.success_count} (${successRate.toFixed(1)}%)`);
    console.log(`   Failed: ${broadcast.failure_count}`);
    console.log(`   Throughput: ${messagesPerSecond.toFixed(2)} msg/sec`);
    console.log(`   Progress: ${broadcast.progress_percentage}%\n`);
    
    console.log('📦 Batch Performance:');
    batches?.forEach(batch => {
      const batchSuccessRate = batch.recipients.length > 0
        ? ((batch.success_count || 0) / batch.recipients.length) * 100
        : 0;
      
      console.log(`   Batch ${batch.batch_number}:`);
      console.log(`      Status: ${batch.status}`);
      console.log(`      Recipients: ${batch.recipients.length}`);
      console.log(`      Success: ${batch.success_count || 0} (${batchSuccessRate.toFixed(1)}%)`);
      console.log(`      Retries: ${batch.retry_count || 0}`);
      
      if (batch.started_at && batch.completed_at) {
        const batchDuration = (new Date(batch.completed_at) - new Date(batch.started_at)) / 1000;
        console.log(`      Duration: ${batchDuration.toFixed(1)}s`);
      }
    });
    
    // Performance recommendations
    console.log('\n💡 Recommendations:');
    if (successRate < 70) {
      console.log('   ⚠️ Low success rate - check phone number validity');
    }
    if (messagesPerSecond < 3) {
      console.log('   ⚠️ Low throughput - consider increasing parallel batches');
    }
    if (broadcast.batches_total > 10) {
      console.log('   ✅ Good batch distribution for large broadcast');
    }
    
  } catch (error) {
    console.error('❌ Analysis error:', error.message);
  }
}

// Example usage
if (process.argv[2]) {
  analyzeBroadcastPerformance(process.argv[2]);
} else {
  console.log('Usage: node analyze-broadcast-performance.js <broadcast_id>');
}

export { analyzeBroadcastPerformance };