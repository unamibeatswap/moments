    // Flag message endpoint
    if (path.includes('/messages/') && path.includes('/flag') && method === 'POST') {
      const messageId = path.split('/messages/')[1].split('/flag')[0]
      
      // Get message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single()
      
      if (messageError || !message) {
        return new Response(JSON.stringify({ error: 'Message not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Update message status to flagged
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          moderation_status: 'flagged',
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
      
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Create audit record
      await supabase
        .from('moderation_audit')
        .insert({
          message_id: messageId,
          action: 'flagged',
          moderator: 'admin',
          timestamp: new Date().toISOString(),
          reason: body?.reason || 'Manual flag'
        })
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Message flagged successfully',
        moderation_status: 'flagged'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }