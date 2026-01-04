import { test, describe } from 'node:test';
import { supabase } from './config/supabase.js';
import { processMedia, checkMediaExists, getMediaByMessage, deleteMedia, MEDIA_CONFIG } from './src/media.js';
import { createStorageBuckets } from './scripts/create_storage_bucket.js';
import assert from 'assert';
import crypto from 'crypto';

// Test configuration
const TEST_CONFIG = {
  testMessage: {
    id: 'test-message-' + Date.now(),
    whatsapp_id: 'wamid.test_' + Date.now(),
    from_number: '+27123456789',
    message_type: 'text',
    content: 'Test message for media storage',
    processed: true
  },
  mockMediaInfo: {
    id: 'test-media-' + Date.now(),
    url: 'https://example.com/test-image.jpg',
    mime_type: 'image/jpeg',
    file_size: 1024 * 50, // 50KB
    sha256: crypto.randomBytes(32).toString('hex')
  }
};

describe('Media Storage System', () => {
  let testMessageId = null;
  
  describe('Database Setup', () => {
    test('should connect to database', async () => {
      const { data, error } = await supabase.from('messages').select('id').limit(1);
      assert.ok(!error, `Database connection failed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'Should return array');
      console.log('✅ Database connection successful');
    });
    
    test('should have media table with required columns', async () => {
      const { data, error } = await supabase
        .from('media')
        .select('id, message_id, whatsapp_media_id, media_type, storage_path, file_size, mime_type, content_hash, bucket_name, processed')
        .limit(1);
      
      assert.ok(!error, `Media table query failed: ${error?.message}`);
      console.log('✅ Media table structure verified');
    });
    
    test('should have media processing queue table', async () => {
      const { data, error } = await supabase
        .from('media_processing_queue')
        .select('id, message_id, whatsapp_media_id, status, priority')
        .limit(1);
      
      assert.ok(!error, `Media processing queue table missing: ${error?.message}`);
      console.log('✅ Media processing queue table verified');
    });
  });
  
  describe('Storage Buckets', () => {
    test('should create all required storage buckets', async () => {
      console.log('Creating storage buckets...');
      await createStorageBuckets();
      
      // Verify buckets exist
      const { data: buckets, error } = await supabase.storage.listBuckets();
      assert.ok(!error, `Failed to list buckets: ${error?.message}`);
      
      const bucketNames = buckets.map(b => b.name);
      const requiredBuckets = ['images', 'audio', 'videos', 'documents'];
      
      for (const bucket of requiredBuckets) {
        assert.ok(bucketNames.includes(bucket), `Missing bucket: ${bucket}`);
      }
      
      console.log(`✅ All ${requiredBuckets.length} storage buckets verified`);
    });
    
    test('should access each bucket', async () => {
      const buckets = ['images', 'audio', 'videos', 'documents'];
      
      for (const bucket of buckets) {
        const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1 });
        assert.ok(!error, `Cannot access bucket ${bucket}: ${error?.message}`);
        console.log(`✅ Bucket '${bucket}' accessible`);
      }
    });
  });
  
  describe('Message Storage', () => {
    test('should create test message', async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert(TEST_CONFIG.testMessage)
        .select('id')
        .single();
      
      assert.ok(!error, `Failed to create test message: ${error?.message}`);
      assert.ok(data?.id, 'Message should have ID');
      
      testMessageId = data.id;
      console.log(`✅ Test message created: ${testMessageId}`);
    });
    
    test('should retrieve test message', async () => {
      assert.ok(testMessageId, 'Test message ID required');
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', testMessageId)
        .single();
      
      assert.ok(!error, `Failed to retrieve message: ${error?.message}`);
      assert.strictEqual(data.whatsapp_id, TEST_CONFIG.testMessage.whatsapp_id);
      assert.strictEqual(data.from_number, TEST_CONFIG.testMessage.from_number);
      
      console.log('✅ Test message retrieved successfully');
    });
  });
  
  describe('Media Configuration', () => {
    test('should have valid media configuration', () => {
      assert.ok(MEDIA_CONFIG, 'Media config should exist');
      assert.ok(MEDIA_CONFIG.maxFileSize > 0, 'Max file size should be positive');
      assert.ok(MEDIA_CONFIG.allowedTypes, 'Allowed types should be defined');
      assert.ok(MEDIA_CONFIG.buckets, 'Buckets mapping should be defined');
      
      // Check each media type has allowed MIME types
      const mediaTypes = ['image', 'audio', 'video', 'document'];
      for (const type of mediaTypes) {
        assert.ok(Array.isArray(MEDIA_CONFIG.allowedTypes[type]), `${type} should have allowed types array`);
        assert.ok(MEDIA_CONFIG.allowedTypes[type].length > 0, `${type} should have at least one allowed type`);
        assert.ok(MEDIA_CONFIG.buckets[type], `${type} should have bucket mapping`);
      }
      
      console.log('✅ Media configuration validated');
    });
  });
  
  describe('Media Processing Functions', () => {
    test('should check media deduplication', async () => {
      const testHash = crypto.randomBytes(32).toString('hex');
      const testSha256 = crypto.randomBytes(32).toString('hex');
      
      // Should return null for non-existent media
      const result = await checkMediaExists(testHash, testSha256);
      assert.strictEqual(result, null, 'Should return null for non-existent media');
      
      console.log('✅ Media deduplication check working');
    });
    
    test('should get media by message ID', async () => {
      assert.ok(testMessageId, 'Test message ID required');
      
      const media = await getMediaByMessage(testMessageId);
      assert.ok(Array.isArray(media), 'Should return array');
      
      console.log(`✅ Retrieved ${media.length} media files for message`);
    });
  });
  
  describe('Media Analytics', () => {
    test('should get media storage statistics', async () => {
      const { data, error } = await supabase.rpc('get_media_storage_stats');
      
      assert.ok(!error, `Failed to get storage stats: ${error?.message}`);
      assert.ok(data, 'Should return statistics data');
      assert.ok(typeof data.total_files === 'number', 'Should have total_files count');
      assert.ok(typeof data.total_size_mb === 'number', 'Should have total_size_mb');
      
      console.log('✅ Media storage statistics retrieved');
      console.log(`📊 Total files: ${data.total_files}, Total size: ${data.total_size_mb}MB`);
    });
    
    test('should have media analytics table', async () => {
      const { data, error } = await supabase
        .from('media_analytics')
        .select('*')
        .limit(5);
      
      assert.ok(!error, `Media analytics query failed: ${error?.message}`);
      assert.ok(Array.isArray(data), 'Should return array');
      
      console.log(`✅ Media analytics table accessible (${data.length} records)`);
    });
  });
  
  describe('Storage Validation', () => {
    test('should validate file size limits', () => {
      const maxSize = MEDIA_CONFIG.maxFileSize;
      assert.ok(maxSize > 0, 'Max file size should be positive');
      assert.ok(maxSize <= 100 * 1024 * 1024, 'Max file size should be reasonable (≤100MB)');
      
      console.log(`✅ File size limit: ${Math.round(maxSize / 1024 / 1024)}MB`);
    });
    
    test('should validate MIME type restrictions', () => {
      const imageTypes = MEDIA_CONFIG.allowedTypes.image;
      assert.ok(imageTypes.includes('image/jpeg'), 'Should allow JPEG images');
      assert.ok(imageTypes.includes('image/png'), 'Should allow PNG images');
      
      const audioTypes = MEDIA_CONFIG.allowedTypes.audio;
      assert.ok(audioTypes.includes('audio/mpeg'), 'Should allow MP3 audio');
      
      console.log('✅ MIME type restrictions validated');
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up test data', async () => {
      if (testMessageId) {
        // Delete test message (cascades to media)
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', testMessageId);
        
        if (error) {
          console.warn(`⚠️  Failed to clean up test message: ${error.message}`);
        } else {
          console.log('✅ Test message cleaned up');
        }
      }
    });
  });
});

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running Media Storage Tests');
  console.log('==============================');
}