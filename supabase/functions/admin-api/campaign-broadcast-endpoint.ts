// Enhanced Campaign Broadcast Endpoint
// Replace lines 1614-1750 in admin-api/index.ts

if (path.includes('/campaigns/') && path.includes('/broadcast') && method === 'POST') {
  const campaignId = path.split('/campaigns/')[1].split('/broadcast')[0]

  console.log('📢 Broadcasting campaign with full integration:', campaignId)

  try {
    // Get campaign with sponsor
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, sponsors(display_name, tier)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Lookup authority for campaign creator
    const { data: authorityData } = await supabase.rpc('lookup_campaign_authority', {
      p_user_identifier: campaign.created_by || 'system'
    })
    
    const authorityContext = authorityData?.[0] || null
    console.log('👤 Authority:', authorityContext?.role_label || 'None')

    // Get active subscribers with region filtering
    let subscriberQuery = supabase
      .from('subscriptions')
      .select('phone_number, regions')
      .eq('opted_in', true)

    if (campaign.target_regions?.length > 0) {
      subscriberQuery = subscriberQuery.overlaps('regions', campaign.target_regions)
    }

    const { data: allSubscribers } = await subscriberQuery
    let subscribers = allSubscribers || []

    // Apply authority blast radius limit
    if (authorityContext?.blast_radius && subscribers.length > authorityContext.blast_radius) {
      console.log(`⚠️ Blast radius limit: ${authorityContext.blast_radius}`)
      subscribers = subscribers.slice(0, authorityContext.blast_radius)
    }

    const recipientCount = subscribers.length
    const MESSAGE_COST = parseFloat(Deno.env.get('MESSAGE_COST') || '0.65')
    const estimatedCost = recipientCount * MESSAGE_COST

    // Check budget
    if (campaign.budget > 0) {
      const { data: budgetCheck } = await supabase.rpc('check_campaign_budget', {
        p_campaign_id: campaignId,
        p_spend_amount: estimatedCost
      })

      if (budgetCheck && !budgetCheck.allowed) {
        return new Response(JSON.stringify({ 
          error: `Budget check failed: ${budgetCheck.reason}`,
          budget_used: budgetCheck.budget_used
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      console.log('✅ Budget check passed')
    }

    // Create moment from campaign
    const momentData = {
      title: campaign.title,
      content: campaign.content,
      region: campaign.target_regions?.[0] || 'National',
      category: campaign.target_categories?.[0] || 'General',
      sponsor_id: campaign.sponsor_id,
      is_sponsored: !!campaign.sponsor_id,
      content_source: 'campaign',
      campaign_id: campaignId,
      status: 'broadcasted',
      broadcasted_at: new Date().toISOString(),
      media_urls: campaign.media_urls || [],
      created_by: campaign.created_by || 'campaign_system'
    }

    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .insert(momentData)
      .select()
      .single()

    if (momentError) {
      return new Response(JSON.stringify({ error: momentError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📝 Moment created:', moment.id)

    // Import template selection (note: this needs to be available in Deno environment)
    // For now, select template based on authority level
    let templateName = 'community_moment_v1'
    if (authorityContext) {
      if (authorityContext.authority_level >= 4) {
        templateName = 'official_announcement_v1'
      } else if (campaign.sponsor_id) {
        templateName = 'verified_sponsored_v1'
      } else {
        templateName = 'verified_moment_v1'
      }
    }

    console.log('📋 Using template:', templateName)

    // Create broadcast record
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: moment.id,
        recipient_count: recipientCount,
        status: 'processing',
        broadcast_started_at: new Date().toISOString(),
        authority_context: authorityContext ? {
          authority_level: authorityContext.authority_level,
          role_label: authorityContext.role_label,
          blast_radius: authorityContext.blast_radius
        } : null
      })
      .select()
      .single()

    // Log marketing compliance
    await supabase.from('marketing_compliance').insert({
      moment_id: moment.id,
      broadcast_id: broadcast.id,
      template_used: templateName,
      template_category: 'MARKETING',
      sponsor_disclosed: !!campaign.sponsor_id,
      opt_out_included: true,
      pwa_link_included: true,
      compliance_score: 100
    }).catch(err => console.warn('Compliance log:', err.message))

    // Trigger WhatsApp broadcast via webhook
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-webhook`
    const webhookPayload = {
      broadcast_id: broadcast.id,
      moment_id: moment.id,
      template_name: templateName,
      authority_context: authorityContext,
      recipients: subscribers.map(s => s.phone_number)
    }

    console.log('📤 Triggering broadcast to', recipientCount, 'subscribers')

    // Trigger async
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    }).then(async (res) => {
      if (res.ok) {
        console.log('✅ Broadcast triggered')
        
        // Log budget transaction (estimate, actual will be updated by webhook)
        const actualCost = recipientCount * MESSAGE_COST
        
        await supabase.from('budget_transactions').insert({
          campaign_id: campaignId,
          transaction_type: 'spend',
          amount: actualCost,
          recipient_count: recipientCount,
          cost_per_recipient: MESSAGE_COST,
          description: `Campaign: ${campaign.title}`
        })

        // Update campaign stats
        await supabase.rpc('update_campaign_stats', {
          p_campaign_id: campaignId,
          p_recipient_count: recipientCount,
          p_cost: actualCost
        });

        // Log template performance
        await supabase.rpc('log_template_performance', {
          p_template_name: templateName,
          p_campaign_id: campaignId,
          p_authority_level: authorityContext?.authority_level || 0,
          p_sends: recipientCount,
          p_deliveries: recipientCount, // Will be updated by webhook
          p_failures: 0,
          p_cost: actualCost
        })

        // Update campaign
        await supabase
          .from('campaigns')
          .update({ 
            status: 'published',
            template_name: templateName,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId)
      } else {
        console.error('❌ Broadcast failed:', await res.text())
      }
    }).catch(err => console.error('Webhook error:', err.message))

    return new Response(JSON.stringify({
      success: true,
      message: `Broadcasting campaign to ${recipientCount} subscribers`,
      campaign_id: campaignId,
      moment_id: moment.id,
      broadcast_id: broadcast.id,
      recipient_count: recipientCount,
      template: templateName,
      authority_level: authorityContext?.authority_level || 0,
      estimated_cost: estimatedCost
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Campaign broadcast error:', error.message)
    
    await supabase
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId)
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
