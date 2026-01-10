-- Lower confidence threshold for auto-approval from 80% to 50%
CREATE OR REPLACE FUNCTION process_auto_approval_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process messages with 50% confidence threshold (was 80%)
  FOR message_record IN
    SELECT m.id, m.content, m.from_number, m.message_type
    FROM messages m
    JOIN advisories a ON m.id = a.message_id
    WHERE m.processed = false
      AND a.escalation_suggested = false
      AND a.confidence >= 0.5  -- Lowered from 0.8 to 0.5
      AND m.created_at > NOW() - INTERVAL '24 hours'
      AND (
        LENGTH(m.content) >= 10 OR
        m.message_type IN ('image', 'video', 'audio', 'document')
      )
      AND LENGTH(COALESCE(m.content, '')) <= 1000
    ORDER BY m.created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      IF auto_approve_message_to_moment(message_record.id) THEN
        processed_count := processed_count + 1;
        RAISE NOTICE 'Auto-approved message % from %', message_record.id, message_record.from_number;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to auto-approve message %: %', message_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN processed_count;
END;
$$;