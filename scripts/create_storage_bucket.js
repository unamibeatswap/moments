import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define all required buckets for media storage
const BUCKETS = [
  { name: 'images', public: true, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
  { name: 'audio', public: false, allowedMimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac'] },
  { name: 'videos', public: false, allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
  { name: 'documents', public: false, allowedMimeTypes: ['application/pdf', 'text/plain', 'application/msword'] }
];

async function createStorageBuckets() {
  console.log('🗄️  Creating Supabase Storage Buckets for Media');
  console.log('===============================================');
  
  try {
    // List existing buckets
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn('⚠️  Warning: Could not list existing buckets:', listError.message);
    }
    
    const existingNames = existingBuckets?.map(b => b.name) || [];
    console.log(`📋 Found ${existingNames.length} existing buckets:`, existingNames);
    
    // Create each required bucket
    for (const bucket of BUCKETS) {
      console.log(`\n📁 Processing bucket: ${bucket.name}`);
      
      if (existingNames.includes(bucket.name)) {
        console.log(`✅ Bucket '${bucket.name}' already exists`);
        
        // Update bucket settings if needed
        try {
          const { error: updateError } = await supabase.storage.updateBucket(bucket.name, {
            public: bucket.public,
            allowedMimeTypes: bucket.allowedMimeTypes,
            fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
          });
          if (updateError) {
            console.warn(`⚠️  Could not update bucket settings: ${updateError.message}`);
          } else {
            console.log(`🔧 Updated bucket settings (public: ${bucket.public})`);
          }
        } catch (e) {
          console.warn(`⚠️  Bucket update not supported: ${e.message}`);
        }
        continue;
      }
      
      // Create new bucket
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
      });
      
      if (error) {
        console.error(`❌ Failed to create bucket '${bucket.name}':`, error.message);
        continue;
      }
      
      console.log(`✅ Created bucket '${bucket.name}' (public: ${bucket.public})`);
      console.log(`   Allowed types: ${bucket.allowedMimeTypes.join(', ')}`);
    }
    
    // Verify all buckets exist
    console.log('\n🔍 Verifying bucket creation...');
    const { data: finalBuckets, error: finalError } = await supabase.storage.listBuckets();
    if (finalError) {
      console.error('❌ Could not verify buckets:', finalError.message);
      return;
    }
    
    const finalNames = finalBuckets?.map(b => b.name) || [];
    const missingBuckets = BUCKETS.filter(b => !finalNames.includes(b.name));
    
    if (missingBuckets.length === 0) {
      console.log('✅ All required buckets are available');
      console.log('📊 Total buckets:', finalNames.length);
      
      // Test bucket access
      console.log('\n🧪 Testing bucket access...');
      for (const bucket of BUCKETS) {
        try {
          const { data, error } = await supabase.storage.from(bucket.name).list('', { limit: 1 });
          if (error) {
            console.warn(`⚠️  Cannot access bucket '${bucket.name}': ${error.message}`);
          } else {
            console.log(`✅ Bucket '${bucket.name}' accessible (${data?.length || 0} files)`);
          }
        } catch (e) {
          console.warn(`⚠️  Bucket '${bucket.name}' test failed: ${e.message}`);
        }
      }
      
    } else {
      console.error('❌ Missing buckets:', missingBuckets.map(b => b.name));
      process.exit(1);
    }
    
    console.log('\n🎉 Storage bucket setup complete!');
    
  } catch (error) {
    console.error('❌ Storage bucket setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createStorageBuckets();
}

export { createStorageBuckets, BUCKETS };
