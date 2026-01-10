-- Complete cleanup and redeployment of soft moderation system

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS advisories_soft_moderation ON advisories;

-- Drop functions
DROP FUNCTION IF EXISTS auto_approve_message_to_moment(UUID);
DROP FUNCTION IF EXISTS process_auto_approval_queue();
DROP FUNCTION IF EXISTS trigger_soft_moderation();

-- Automated Soft Moderation System
-- Converts community messages to moments based on MCP analysis

-- Function to auto-approve and convert messages to moments
CREATE OR REPLACE FUNCTION auto_approve_message_to_moment(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_record RECORD;
  advisory_record RECORD;
  moment_id UUID;
  auto_title TEXT;
  auto_region TEXT;
  auto_category TEXT;
BEGIN
  -- Get message details
  SELECT * INTO message_record FROM messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;
  
  -- Get latest advisory for this message
  SELECT * INTO advisory_record 
  FROM advisories 
  WHERE message_id = p_message_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Check if advisory exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No advisory found for message: %', p_message_id;
  END IF;
  
  -- Check if message qualifies for auto-approval
  IF advisory_record.escalation_suggested = true THEN
    RETURN false; -- Don't approve escalated messages
  END IF;
  
  IF advisory_record.confidence < 0.8 THEN
    RETURN false; -- Only approve high confidence messages
  END IF;
  
  -- Auto-generate title (first 50 chars or first sentence)
  auto_title := CASE
    WHEN LENGTH(message_record.content) <= 50 THEN message_record.content
    WHEN POSITION('.' IN message_record.content) > 0 AND POSITION('.' IN message_record.content) <= 80 THEN
      SUBSTRING(message_record.content FROM 1 FOR POSITION('.' IN message_record.content) - 1)
    ELSE
      SUBSTRING(message_record.content FROM 1 FOR 50) || '...'
  END;
  
  -- Auto-detect region (default to National)
  auto_region := 'National';
  
  -- Auto-detect category based on content
  auto_category := CASE
    WHEN message_record.content ~* '\\b(school|education|learn|study|training|workshop)\\b' THEN 'Education'
    WHEN message_record.content ~* '\\b(safety|security|crime|police|emergency)\\b' THEN 'Safety'
    WHEN message_record.content ~* '\\b(culture|heritage|festival|celebration|tradition)\\b' THEN 'Culture'
    WHEN message_record.content ~* '\\b(job|work|opportunity|employment|business)\\b' THEN 'Opportunity'
    WHEN message_record.content ~* '\\b(event|meeting|gathering|conference)\\b' THEN 'Events'
    WHEN message_record.content ~* '\\b(health|medical|clinic|hospital|doctor)\\b' THEN 'Health'
    WHEN message_record.content ~* '\\b(technology|tech|digital|computer|internet)\\b' THEN 'Technology'
    ELSE 'Community'
  END;
  
  -- Create moment from message
  INSERT INTO moments (
    title,
    content,
    region,
    category,
    language,
    content_source,
    status,
    created_by
  ) VALUES (
    auto_title,
    message_record.content,
    auto_region,
    auto_category,
    COALESCE(message_record.language_detected, 'eng'),
    'community',
    'draft',
    'auto_moderation'
  ) RETURNING id INTO moment_id;
  
  -- Mark message as processed
  UPDATE messages 
  SET processed = true 
  WHERE id = p_message_id;
  
  -- Log the auto-approval
  INSERT INTO flags (
    message_id,
    flag_type,
    severity,
    action_taken,
    notes
  ) VALUES (
    p_message_id,
    'auto_approved',
    'low',
    'converted_to_moment',
    'Automatically approved and converted to moment: ' || moment_id
  );
  
  RETURN true;
END;
$$;

-- Function to process auto-approval queue (called by background job)
CREATE OR REPLACE FUNCTION process_auto_approval_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process messages that are ready for auto-approval
  FOR message_record IN
    SELECT m.id, m.content, m.from_number
    FROM messages m
    JOIN advisories a ON m.id = a.message_id
    WHERE m.processed = false
      AND a.escalation_suggested = false
      AND a.confidence >= 0.8
      AND m.created_at > NOW() - INTERVAL '24 hours'
      AND LENGTH(m.content) >= 10
      AND LENGTH(m.content) <= 1000
    ORDER BY m.created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Attempt to auto-approve
      IF auto_approve_message_to_moment(message_record.id) THEN
        processed_count := processed_count + 1;
        RAISE NOTICE 'Auto-approved message % from %', message_record.id, message_record.from_number;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log failure but continue processing
      RAISE NOTICE 'Failed to auto-approve message %: %', message_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN processed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_approve_message_to_moment TO service_role;
GRANT EXECUTE ON FUNCTION process_auto_approval_queue TO service_role;

-- Create indexes for efficient auto-approval queries
CREATE INDEX IF NOT EXISTS idx_messages_auto_approval 
ON messages (processed, created_at) 
WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_advisories_auto_approval 
ON advisories (message_id, escalation_suggested, confidence) 
WHERE escalation_suggested = false;