import { supabase } from '../config/supabase.js';
import { getMedia, downloadMedia } from '../config/whatsapp.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Media processing configuration
const MEDIA_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/amr'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'],
    document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  buckets: {
    image: 'images',
    audio: 'audio',
    video: 'videos',
    document: 'documents'
  }
};

/**
 * Process media from WhatsApp message
 * @param {string} messageId - Database message ID
 * @param {string} mediaId - WhatsApp media ID
 * @param {string} mediaType - Media type (image, audio, video, document)
 * @returns {Promise<Object|null>} Media processing result
 */
export const processMedia = async (messageId, mediaId, mediaType) => {
  const startTime = Date.now();
  console.log(`📷 Processing ${mediaType} media: ${mediaId}`);
  
  try {
    // Step 1: Get media info from WhatsApp
    const mediaInfo = await getMediaInfo(mediaId);
    if (!mediaInfo) {
      throw new Error('Could not retrieve media info from WhatsApp');
    }
    
    // Step 2: Validate media
    validateMedia(mediaInfo, mediaType);
    
    // Step 3: Download media
    const mediaBuffer = await downloadMediaBuffer(mediaInfo.url);
    
    // Step 4: Generate file path and metadata
    const fileMetadata = generateFileMetadata(mediaInfo, mediaType, mediaBuffer);
    
    // Step 5: Upload to Supabase Storage
    const uploadResult = await uploadToStorage(fileMetadata, mediaBuffer);
    
    // Step 6: Store metadata in database
    const mediaRecord = await storeMediaRecord({
      messageId,
      mediaId,
      mediaType,
      mediaInfo,
      fileMetadata,
      uploadResult
    });
    
    // Step 7: Generate public URL if needed
    const publicUrl = await getPublicUrl(fileMetadata.bucket, fileMetadata.filePath);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Media processed successfully in ${processingTime}ms`);
    
    return {
      id: mediaRecord.id,
      mediaType,
      filePath: fileMetadata.filePath,
      publicUrl,
      fileSize: fileMetadata.fileSize,
      mimeType: fileMetadata.mimeType,
      bucket: fileMetadata.bucket,
      processed: true,
      processingTime
    };
    
  } catch (error) {
    console.error(`❌ Media processing failed for ${mediaId}:`, error.message);
    
    // Log failure for monitoring
    await logMediaFailure(messageId, mediaId, mediaType, error);
    
    return null;
  }
};

/**
 * Get media information from WhatsApp API
 */
async function getMediaInfo(mediaId) {
  try {
    const mediaInfo = await getMedia(mediaId);
    return {
      id: mediaInfo.id,
      url: mediaInfo.url,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      sha256: mediaInfo.sha256
    };
  } catch (error) {
    console.error('Failed to get media info:', error.message);
    return null;
  }
}

/**
 * Validate media against configuration
 */
function validateMedia(mediaInfo, mediaType) {
  // Check file size
  if (mediaInfo.file_size > MEDIA_CONFIG.maxFileSize) {
    throw new Error(`File size ${mediaInfo.file_size} exceeds limit ${MEDIA_CONFIG.maxFileSize}`);
  }
  
  // Check MIME type
  const allowedTypes = MEDIA_CONFIG.allowedTypes[mediaType] || [];
  if (!allowedTypes.includes(mediaInfo.mime_type)) {
    throw new Error(`MIME type ${mediaInfo.mime_type} not allowed for ${mediaType}`);
  }
}

/**
 * Download media as buffer
 */
async function downloadMediaBuffer(mediaUrl) {
  try {
    const stream = await downloadMedia(mediaUrl);
    const chunks = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Media download failed: ${error.message}`);
  }
}

/**
 * Generate file metadata
 */
function generateFileMetadata(mediaInfo, mediaType, buffer) {
  const extension = getFileExtension(mediaInfo.mime_type);
  const fileName = `${uuidv4()}.${extension}`;
  const date = new Date();
  const filePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${fileName}`;
  const bucket = MEDIA_CONFIG.buckets[mediaType] || 'documents';
  
  // Generate content hash for deduplication
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  
  return {
    fileName,
    filePath,
    bucket,
    fileSize: buffer.length,
    mimeType: mediaInfo.mime_type,
    contentHash,
    whatsappSha256: mediaInfo.sha256
  };
}

/**
 * Upload media to Supabase Storage
 */
async function uploadToStorage(fileMetadata, buffer) {
  const { data, error } = await supabase.storage
    .from(fileMetadata.bucket)
    .upload(fileMetadata.filePath, buffer, {
      contentType: fileMetadata.mimeType,
      upsert: false,
      duplex: 'half'
    });
  
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  
  return data;
}

/**
 * Store media record in database
 */
async function storeMediaRecord({ messageId, mediaId, mediaType, mediaInfo, fileMetadata, uploadResult }) {
  const { data, error } = await supabase
    .from('media')
    .insert({
      message_id: messageId,
      whatsapp_media_id: mediaId,
      media_type: mediaType,
      original_url: mediaInfo.url,
      storage_path: fileMetadata.filePath,
      file_size: fileMetadata.fileSize,
      mime_type: fileMetadata.mimeType,
      content_hash: fileMetadata.contentHash,
      whatsapp_sha256: fileMetadata.whatsappSha256,
      bucket_name: fileMetadata.bucket,
      processed: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }
  
  return data;
}

/**
 * Get public URL for media
 */
async function getPublicUrl(bucket, filePath) {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.warn('Could not generate public URL:', error.message);
    return null;
  }
}

/**
 * Log media processing failure
 */
async function logMediaFailure(messageId, mediaId, mediaType, error) {
  try {
    await supabase.from('flags').insert({
      message_id: messageId,
      flag_type: 'media_processing_failed',
      severity: 'medium',
      action_taken: 'logged',
      notes: `Media ID: ${mediaId}, Type: ${mediaType}, Error: ${error.message}`,
      created_at: new Date().toISOString()
    });
  } catch (logError) {
    console.error('Failed to log media failure:', logError.message);
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType) {
  const extensions = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'audio/mp4': 'm4a',
    
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/3gpp': '3gp',
    'video/avi': 'avi',
    
    // Documents
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  };
  
  return extensions[mimeType] || 'bin';
}

/**
 * Check if media already exists (deduplication)
 */
export const checkMediaExists = async (contentHash, whatsappSha256) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('id, storage_path, bucket_name')
      .or(`content_hash.eq.${contentHash},whatsapp_sha256.eq.${whatsappSha256}`)
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('Media deduplication check failed:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Media deduplication error:', error.message);
    return null;
  }
};

/**
 * Get media by message ID
 */
export const getMediaByMessage = async (messageId) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get media: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Get media error:', error.message);
    return [];
  }
};

/**
 * Delete media (both storage and database record)
 */
export const deleteMedia = async (mediaId) => {
  try {
    // Get media record
    const { data: media, error: getError } = await supabase
      .from('media')
      .select('storage_path, bucket_name')
      .eq('id', mediaId)
      .single();
    
    if (getError) {
      throw new Error(`Media not found: ${getError.message}`);
    }
    
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(media.bucket_name)
      .remove([media.storage_path]);
    
    if (storageError) {
      console.warn('Storage deletion failed:', storageError.message);
    }
    
    // Delete database record
    const { error: dbError } = await supabase
      .from('media')
      .delete()
      .eq('id', mediaId);
    
    if (dbError) {
      throw new Error(`Database deletion failed: ${dbError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('Delete media error:', error.message);
    return false;
  }
};

export { MEDIA_CONFIG };