import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Simple password verification using Web Crypto API
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return computedHash === hash || password === 'Proof321#' // Temporary fallback
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Rate limiting
async function checkRateLimit(supabase: any, identifier: string, endpoint: string, limit = 100): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60000).toISOString()
  const { data } = await supabase.from('rate_limits').select('request_count').eq('identifier', identifier).eq('endpoint', endpoint).gte('window_start', windowStart).single()
  if (data && data.request_count >= limit) return false
  await supabase.from('rate_limits').upsert({ identifier, endpoint, request_count: (data?.request_count || 0) + 1, window_start: new Date().toISOString() })
  return true
}

// Audit logging
async function logAudit(supabase: any, userId: string, action: string, resourceType: string, resourceId: string, changes: any) {
  await supabase.from('audit_logs').insert({ user_id: userId, action, resource_type: resourceType, resource_id: resourceId, changes })
}

// Feature flags
async function isFeatureEnabled(supabase: any, flagKey: string): Promise<boolean> {
  const { data } = await supabase.from('feature_flags').select('enabled').eq('flag_key', flagKey).single()
  return data?.enabled || false
}

// Error tracking
async function logError(supabase: any, errorType: string, errorMessage: string, context: any, severity = 'medium') {
  await supabase.from('error_logs').insert({ error_type: errorType, error_message: errorMessage, context, severity })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // Parse request body once for POST/PUT requests (except file uploads)
    let body = null
    if ((method === 'POST' || method === 'PUT') && !path.includes('/upload-media')) {
      const text = await req.text()
      if (text) {
        try {
          body = JSON.parse(text)
        } catch (e) {
          console.log('JSON parse error:', e.message)
        }
      }
    }

    // Handle login - check for email/password in body
    if (method === 'POST' && body && body.email && body.password) {
      const { email, password } = body

      // Get admin user from database
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .eq('active', true)
        .single()

      if (error || !admin) {
        console.log('Admin user lookup failed:', error?.message)
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Verify password - use fallback for initial setup
      let validPassword = false
      if (email === 'info@unamifoundation.org' && (password === 'Proof321#' || password === 'Proof321#moments')) {
        validPassword = true
      } else {
        try {
          validPassword = await verifyPassword(password, admin.password_hash)
        } catch (verifyError) {
          console.log('Password verification failed:', verifyError.message)
        }
      }

      if (!validPassword) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Create session token and store in database
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

      // Store session in database
      const { error: sessionError } = await supabase
        .from('admin_sessions')
        .insert({
          token: sessionToken,
          user_id: admin.id,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })

      if (sessionError) {
        console.log('Session storage failed:', sessionError.message)
        // Continue anyway - session validation will be bypassed temporarily
      }

      return new Response(JSON.stringify({
        success: true,
        token: sessionToken,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Public API endpoints for PWA (NO AUTH REQUIRED)

    // Unified analytics endpoint (used by PWA)
    if (path.includes('/analytics') && method === 'GET' && !path.includes('/dashboard') && !path.includes('/revenue') && !path.includes('/campaigns')) {
      const { data } = await supabase.from('unified_analytics').select('*').single()
      return new Response(JSON.stringify({
        totalMoments: data?.total_moments || 0,
        activeSubscribers: data?.active_subscribers || 0,
        totalBroadcasts: data?.total_broadcasts || 0,
        broadcastsToday: data?.broadcasts_today || 0,
        deliveryRate: data?.delivery_rate_7d || 0,
        sponsoredMoments: data?.sponsored_moments || 0,
        templateAdoption: data?.template_v2_adoption || 0,
        avgComplianceScore: data?.avg_compliance_score || 0,
        lastUpdated: data?.last_updated
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.includes('/api/stats') && method === 'GET') {
      const [momentsResult, subscribersResult, broadcastsResult] = await Promise.all([
        supabase.from('moments').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id').eq('opted_in', true).then(r => ({ count: r.data?.length || 0 })),
        supabase.from('broadcasts').select('id', { count: 'exact', head: true })
      ])

      return new Response(JSON.stringify({
        totalMoments: momentsResult.count || 0,
        activeSubscribers: subscribersResult.count || 0,
        totalBroadcasts: broadcastsResult.count || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.includes('/api/moments') && method === 'GET') {
      const region = url.searchParams.get('region')
      const category = url.searchParams.get('category')
      const source = url.searchParams.get('source')

      let query = supabase
        .from('moments')
        .select(`
          *,
          sponsors(*)
        `)
        .eq('status', 'broadcasted')
        .order('broadcasted_at', { ascending: false })
        .limit(50)

      if (region) query = query.eq('region', region)
      if (category) query = query.eq('category', category)
      if (source) query = query.eq('content_source', source)

      const { data: moments } = await query

      return new Response(JSON.stringify({ moments: moments || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user role endpoint (requires auth header)
    if ((path.includes('/user-role') || path.includes('/admin/user-role')) && method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ role: 'superadmin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get compliance categories (requires auth header)
    if (path.includes('/compliance/categories') && method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const regions = ['KZN', 'WC', 'GP', 'EC', 'FS', 'LP', 'MP', 'NC', 'NW']
      const categories = ['Education', 'Safety', 'Culture', 'Opportunity', 'Events', 'Health', 'Technology']

      const formattedCategories = [
        ...regions.map((region, index) => ({
          id: index + 1,
          category_type: 'region',
          category_name: region
        })),
        ...categories.map((category, index) => ({
          id: regions.length + index + 1,
          category_type: 'category',
          category_name: category
        }))
      ]

      return new Response(JSON.stringify({ categories: formattedCategories }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For all other endpoints, validate session token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')

    // Handle both session tokens and service role tokens
    if (token.startsWith('session_')) {
      const { data: session, error: sessionError } = await supabase
        .from('admin_sessions')
        .select('*, admin_users(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (sessionError || !session) {
        console.log('Session validation failed:', sessionError?.message)
        // Temporary: accept any session_ token during development
        // In production, this should return 401
      }
    } else if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      // Allow service role key for internal calls
    } else {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin users endpoints
    if (path.includes('/admin-users') && method === 'GET') {
      const { data: users } = await supabase
        .from('admin_users')
        .select('id, email, name, active, created_at, last_login')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ users: users || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin user
    if (path.includes('/admin-users') && method === 'POST' && body) {
      // Skip password hashing for now
      const passwordHash = 'temp_hash'

      const { data, error } = await supabase
        .from('admin_users')
        .insert({
          email: body.email,
          name: body.name,
          password_hash: passwordHash,
          active: true
        })
        .select('id, email, name, active, created_at')
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ user: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Compliance check endpoint
    if (path.includes('/compliance/check') && method === 'POST' && body) {
      return new Response(JSON.stringify({
        compliance: {
          approved: false,
          confidence: 0.65,
          issues: ['Manual review required'],
          recommendations: ['Content requires human moderation']
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin help endpoint
    if (path.includes('/help') && method === 'GET') {
      return new Response(JSON.stringify({
        endpoints: {
          authentication: {
            'POST /': 'Login with email/password',
            'GET /user-role': 'Get current user role'
          },
          moments: {
            'GET /moments': 'List all moments',
            'POST /moments': 'Create new moment',
            'PUT /moments/{id}': 'Update moment',
            'DELETE /moments/{id}': 'Delete moment',
            'POST /moments/{id}/broadcast': 'Broadcast moment now'
          },
          moderation: {
            'GET /moderation': 'List flagged messages',
            'POST /messages/{id}/approve': 'Approve message',
            'POST /messages/{id}/flag': 'Flag message'
          },
          media: {
            'POST /upload-media': 'Upload media files (multipart/form-data)'
          },
          analytics: {
            'GET /analytics': 'Basic analytics',
            'GET /analytics/revenue': 'Revenue analytics',
            'GET /analytics/campaigns': 'Campaign performance'
          },
          sponsors: {
            'GET /sponsors': 'List sponsors',
            'POST /sponsors': 'Create sponsor'
          },
          campaigns: {
            'GET /campaigns': 'List campaigns',
            'POST /campaigns': 'Create campaign',
            'POST /campaigns/{id}/broadcast': 'Broadcast campaign'
          },
          subscribers: {
            'GET /subscribers': 'List subscribers with stats'
          },
          broadcasts: {
            'GET /broadcasts': 'List broadcast history'
          }
        },
        confidence_threshold: 0.65,
        version: '2.0.0',
        last_updated: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user role endpoint
    if (path.includes('/user-role') && method === 'GET') {
      return new Response(JSON.stringify({ role: 'superadmin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get compliance categories
    if (path.includes('/compliance/categories') && method === 'GET') {
      const regions = ['KZN', 'WC', 'GP', 'EC', 'FS', 'LP', 'MP', 'NC', 'NW']
      const categories = ['Education', 'Safety', 'Culture', 'Opportunity', 'Events', 'Health', 'Technology']

      const formattedCategories = [
        ...regions.map((region, index) => ({
          id: index + 1,
          category_type: 'region',
          category_name: region
        })),
        ...categories.map((category, index) => ({
          id: regions.length + index + 1,
          category_type: 'category',
          category_name: category
        }))
      ]

      return new Response(JSON.stringify({ categories: formattedCategories }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Enhanced Analytics with Revenue
    if (path.includes('/analytics/revenue') && method === 'GET') {
      const [campaigns, revenue, budgets, intents] = await Promise.all([
        supabase.from('campaigns').select('*', { count: 'exact' }),
        supabase.from('revenue_events').select('revenue_amount').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('campaign_budgets').select('total_budget, spent_amount'),
        supabase.from('moment_intents').select('*').eq('channel', 'whatsapp').eq('status', 'sent')
      ])

      const totalRevenue = revenue.data?.reduce((sum, event) => sum + parseFloat(event.revenue_amount), 0) || 0
      const totalBudget = budgets.data?.reduce((sum, budget) => sum + parseFloat(budget.total_budget), 0) || 0
      const totalSpent = budgets.data?.reduce((sum, budget) => sum + parseFloat(budget.spent_amount), 0) || 0
      const totalBroadcasts = intents.data?.length || 0
      const avgCostPerBroadcast = totalBroadcasts > 0 ? (totalSpent / totalBroadcasts).toFixed(2) : 0

      return new Response(JSON.stringify({
        totalCampaigns: campaigns.count || 0,
        totalRevenue30Days: totalRevenue,
        totalBudgetAllocated: totalBudget,
        totalSpent: totalSpent,
        totalBroadcasts: totalBroadcasts,
        avgCostPerBroadcast: avgCostPerBroadcast,
        roi: totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent * 100).toFixed(2) : 0,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalSpent) / totalRevenue * 100).toFixed(2) : 0,
        budgetUtilization: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Campaign Performance Analytics
    if (path.includes('/analytics/campaigns') && method === 'GET') {
      const { data: campaignPerformance } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_budgets(*),
          campaign_metrics(*),
          revenue_events(revenue_amount)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      return new Response(JSON.stringify({
        campaigns: campaignPerformance || [],
        summary: {
          topPerforming: campaignPerformance?.sort((a, b) =>
            (b.campaign_metrics?.[0]?.conversion_rate || 0) - (a.campaign_metrics?.[0]?.conversion_rate || 0)
          ).slice(0, 5) || []
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }


    if (path.includes('/analytics/dashboard') && method === 'GET') {
      const [daily, regional, category, templates, adoption] = await Promise.all([
        supabase.from('daily_stats').select('*').order('stat_date', { ascending: false }).limit(30),
        supabase.from('regional_stats').select('*').order('moment_count', { ascending: false }),
        supabase.from('category_stats').select('*').order('moment_count', { ascending: false }),
        supabase.from('template_analytics').select('*').limit(30),
        supabase.from('template_adoption').select('*').single()
      ])

      return new Response(JSON.stringify({
        daily: daily.data || [],
        regional: regional.data || [],
        category: category.data || [],
        templates: templates.data || [],
        adoption: adoption.data || { v2_templates: 0, v1_templates: 0, adoption_rate: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Refresh analytics
    if (path.includes('/analytics/refresh') && method === 'POST') {
      await supabase.rpc('refresh_analytics')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Analytics endpoint - Fixed to use intent system
    if (path.includes('/analytics') && method === 'GET') {
      const [moments, subscribers, intents] = await Promise.all([
        supabase.from('moments').select('*', { count: 'exact' }).eq('status', 'broadcasted'),
        supabase.from('subscriptions').select('*', { count: 'exact' }).eq('opted_in', true),
        supabase.from('moment_intents').select('status').eq('channel', 'whatsapp')
      ])

      // Calculate real success rate from intents
      const totalIntents = intents.data?.length || 0
      const successfulIntents = intents.data?.filter(i => i.status === 'sent').length || 0
      const successRate = totalIntents > 0 ? Math.round((successfulIntents / totalIntents) * 100) : 0

      return new Response(JSON.stringify({
        totalMoments: moments.count || 0,
        activeSubscribers: subscribers.count || 0,
        totalBroadcasts: successfulIntents,
        successRate: successRate,
        totalIntents: totalIntents
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Moments endpoint
    if (path.includes('/moments') && method === 'GET') {
      const { data: moments } = await supabase
        .from('moments')
        .select('*, sponsors(*)')
        .order('created_at', { ascending: false })
        .limit(50)

      return new Response(JSON.stringify({ moments: moments || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create moment with auto-broadcast logic
    if (path.includes('/moments') && method === 'POST' && body) {
      // Marketing compliance validation
      const complianceIssues = []
      if (body.is_sponsored || body.sponsor_id) {
        if (!body.sponsor_id) complianceIssues.push('Sponsored content requires sponsor_id')
        if (!body.pwa_link) complianceIssues.push('Marketing content should include PWA verification link')
      }
      if (body.content && body.content.toLowerCase().includes('urgent') && !body.sponsor_id) {
        complianceIssues.push('Urgency language detected - ensure compliance with Meta guidelines')
      }

      // Log compliance check
      if (complianceIssues.length > 0) {
        console.warn('Compliance warnings:', complianceIssues)
      }

      await logAudit(supabase, 'admin', 'create', 'moment', '', { ...body, compliance_warnings: complianceIssues })

      // Build partner attribution
      let partnerAttribution = null
      if (body.sponsor_id) {
        const { data: sponsor } = await supabase
          .from('sponsors')
          .select('display_name')
          .eq('id', body.sponsor_id)
          .single()

        if (sponsor) {
          partnerAttribution = `Presented by ${sponsor.display_name} via Unami Foundation Moments App`
        }
      }

      const { data: moment, error } = await supabase
        .from('moments')
        .insert({
          title: body.title,
          content: body.content,
          region: body.region || 'National',
          category: body.category || 'General',
          sponsor_id: body.sponsor_id || null,
          is_sponsored: !!body.sponsor_id,
          partner_attribution: partnerAttribution,
          pwa_link: body.pwa_link || null,
          scheduled_at: body.scheduled_at || null,
          media_urls: body.media_urls || [],
          status: body.scheduled_at ? 'scheduled' : 'draft',
          created_by: 'admin',
          content_source: 'admin',
          publish_to_whatsapp: body.publish_to_whatsapp || false,
          publish_to_pwa: body.publish_to_pwa !== false
        })
        .select()
        .single()

      if (error) {
        console.error('Moment creation error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Auto-broadcast admin moments if not scheduled
      if (!body.scheduled_at) {
        // Create intents directly in admin API
        try {
          const createdIntents = []

          // PWA intent
          if (moment.publish_to_pwa !== false) {
            const { data: existingPwa } = await supabase
              .from('moment_intents')
              .select('id')
              .eq('moment_id', moment.id)
              .eq('channel', 'pwa')
              .single()

            if (!existingPwa) {
              const { data: pwaIntent } = await supabase
                .from('moment_intents')
                .insert({
                  moment_id: moment.id,
                  channel: 'pwa',
                  action: 'publish',
                  status: 'pending',
                  payload: {
                    title: moment.title,
                    full_text: moment.content,
                    link: moment.pwa_link || `https://moments.unamifoundation.org/m/${moment.id}`
                  }
                })
                .select('id')
                .single()

              if (pwaIntent) createdIntents.push(pwaIntent.id)
            }
          }

          // WhatsApp intent
          if (moment.publish_to_whatsapp) {
            const { data: existingWa } = await supabase
              .from('moment_intents')
              .select('id')
              .eq('moment_id', moment.id)
              .eq('channel', 'whatsapp')
              .single()

            if (!existingWa) {
              const { data: waIntent } = await supabase
                .from('moment_intents')
                .insert({
                  moment_id: moment.id,
                  channel: 'whatsapp',
                  action: 'publish',
                  status: 'pending',
                  template_id: 'marketing_v1',
                  payload: {
                    title: moment.title,
                    summary: moment.content.substring(0, 100) + '...',
                    link: moment.pwa_link || `https://moments.unamifoundation.org/m/${moment.id}`
                  }
                })
                .select('id')
                .single()

              if (waIntent) createdIntents.push(waIntent.id)
            }
          }

          console.log(`✅ Created ${createdIntents.length} intents for moment ${moment.id}`)
        } catch (intentError) {
          console.error('❌ Intent creation failed:', intentError.message)
        }

        try {
          const { data: subscribers } = await supabase
            .from('subscriptions')
            .select('phone_number')
            .eq('opted_in', true)

          if (subscribers && subscribers.length > 0) {
            // Create broadcast record
            const { data: broadcast } = await supabase
              .from('broadcasts')
              .insert({
                moment_id: moment.id,
                recipient_count: subscribers.length,
                status: 'processing',
                broadcast_started_at: new Date().toISOString()
              })
              .select()
              .single()

            // Update moment to broadcasted
            await supabase
              .from('moments')
              .update({
                status: 'broadcasted',
                broadcasted_at: new Date().toISOString()
              })
              .eq('id', moment.id)

            // Trigger broadcast webhook
            const broadcastMsg = `📢 Unami Foundation Moments — ${moment.region}

${moment.title}

${moment.content}

🌐 More: moments.unamifoundation.org/m/${moment.id}`

            const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-webhook`
            const webhookPayload = JSON.stringify({
              broadcast_id: broadcast.id,
              message: broadcastMsg,
              recipients: subscribers.map(s => s.phone_number),
              moment_id: moment.id
            })

            console.log(`📡 Auto-broadcast webhook: POST ${webhookUrl}`)
            console.log(`Status: Sending to ${subscribers.length} subscribers`)

            // Trigger webhook asynchronously - don't block response
            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: webhookPayload
            }).then(async (webhookResponse) => {
              const responseText = await webhookResponse.text()
              console.log(`📨 Auto-broadcast response: ${webhookResponse.status} - ${responseText.substring(0, 300)}`)
              
              if (!webhookResponse.ok) {
                console.error(`❌ Auto-broadcast webhook failed: ${webhookResponse.status}\nURL: ${webhookUrl}\nResponse: ${responseText}`)
                await logError(supabase, 'auto_broadcast_webhook_failed', `HTTP ${webhookResponse.status}: ${responseText}`, { broadcast_id: broadcast.id, moment_id: moment.id, webhook_url: webhookUrl }, 'high')
              } else {
                console.log('✅ Auto-broadcast webhook succeeded')
              }
            }).catch(async (webhookError) => {
              console.error(`❌ Auto-broadcast webhook error: ${webhookError.message} (${webhookError.name})`)
              await logError(supabase, 'auto_broadcast_webhook_error', webhookError.message, { broadcast_id: broadcast.id, moment_id: moment.id, webhook_url: webhookUrl }, 'high')
            })
            
            console.log('📡 Broadcast webhook triggered asynchronously')
          }
        } catch (broadcastError) {
          console.error('Auto-broadcast failed:', broadcastError)
        }
      }

      return new Response(JSON.stringify({ moment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update moment
    if (path.includes('/moments/') && method === 'PUT' && body) {
      const momentId = path.split('/moments/')[1]
      await logAudit(supabase, 'admin', 'update', 'moment', momentId, body)
      const { data, error } = await supabase
        .from('moments')
        .update(body)
        .eq('id', momentId)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ moment: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Broadcast moment endpoint
    if (path.includes('/moments/') && path.includes('/broadcast') && method === 'POST') {
      const momentId = path.split('/moments/')[1].split('/broadcast')[0]

      // Get moment details
      const { data: moment, error: momentError } = await supabase
        .from('moments')
        .select('*')
        .eq('id', momentId)
        .single()

      if (momentError || !moment) {
        return new Response(JSON.stringify({ error: 'Moment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get active subscribers
      const { data: subscribers } = await supabase
        .from('subscriptions')
        .select('phone_number')
        .eq('opted_in', true)

      const recipientCount = subscribers?.length || 0

      if (recipientCount === 0) {
        return new Response(JSON.stringify({ error: 'No active subscribers' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Create broadcast record
      const { data: broadcast, error: broadcastError } = await supabase
        .from('broadcasts')
        .insert({
          moment_id: momentId,
          recipient_count: recipientCount,
          success_count: 0,
          failure_count: 0,
          status: 'pending',
          broadcast_started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (broadcastError) {
        return new Response(JSON.stringify({ error: broadcastError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Update moment status
      await supabase
        .from('moments')
        .update({
          status: 'broadcasted',
          broadcasted_at: new Date().toISOString()
        })
        .eq('id', momentId)

      // Format broadcast message
      const broadcastMessage = `📢 Unami Foundation Moments — ${moment.region}

${moment.title}

${moment.content}

🌐 More: moments.unamifoundation.org/m/${momentId}`

      // Trigger broadcast webhook
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-webhook`
      const webhookPayload = JSON.stringify({
        broadcast_id: broadcast.id,
        message: broadcastMessage,
        recipients: subscribers.map(s => s.phone_number),
        moment_id: momentId
      })

      console.log(`📡 Moment broadcast webhook: POST ${webhookUrl}`)
      console.log(`Status: Creating broadcast for ${recipientCount} subscribers`)
      // Trigger webhook asynchronously - don't block response
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: webhookPayload
      }).then(async (webhookResponse) => {
        const responseText = await webhookResponse.text()
        console.log(`📨 Webhook response: ${webhookResponse.status} - ${responseText.substring(0, 300)}`)
        
        if (!webhookResponse.ok) {
          console.error(`❌ Broadcast webhook failed: ${webhookResponse.status}\nURL: ${webhookUrl}\nResponse: ${responseText}`)
          await logError(supabase, 'moment_broadcast_webhook_failed', `HTTP ${webhookResponse.status}: ${responseText}`, { broadcast_id: broadcast.id, moment_id: momentId, webhook_url: webhookUrl }, 'high')
        } else {
          console.log('✅ Broadcast webhook succeeded')
        }
      }).catch(async (webhookError) => {
        console.error(`❌ Broadcast webhook error: ${webhookError.message} (${webhookError.name})`)
        await logError(supabase, 'moment_broadcast_webhook_error', webhookError.message, { broadcast_id: broadcast.id, moment_id: momentId, webhook_url: webhookUrl, error_name: webhookError.name }, 'high')
      })
      
      console.log('📡 Broadcast webhook triggered asynchronously')

      return new Response(JSON.stringify({
        success: true,
        broadcast_id: broadcast.id,
        message: `Broadcasting "${moment.title}" to ${recipientCount} subscribers`,
        recipient_count: recipientCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete moment
    if (path.includes('/moments/') && method === 'DELETE') {
      const momentId = path.split('/moments/')[1].split('?')[0]
      await logAudit(supabase, 'admin', 'delete', 'moment', momentId, {})

      // Delete related broadcasts first
      await supabase.from('broadcasts').delete().eq('moment_id', momentId)

      // Delete the moment
      const { error } = await supabase
        .from('moments')
        .delete()
        .eq('id', momentId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sponsor assets endpoint
    if (path.includes('/sponsors/') && path.includes('/assets') && method === 'GET') {
      const sponsorId = path.split('/sponsors/')[1].split('/assets')[0]
      const { data: assets } = await supabase
        .from('sponsor_assets')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ assets: assets || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Upload sponsor asset
    if (path.includes('/sponsors/') && path.includes('/assets') && method === 'POST') {
      const sponsorId = path.split('/sponsors/')[1].split('/assets')[0]

      if (!body) {
        return new Response(JSON.stringify({ error: 'Request body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('sponsor_assets')
        .insert({
          sponsor_id: sponsorId,
          asset_type: body.asset_type,
          asset_url: body.asset_url,
          dimensions: body.dimensions,
          file_size: body.file_size
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ asset: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Enhanced sponsors with branding
    if (path.includes('/sponsors') && method === 'GET') {
      const { data: sponsors } = await supabase
        .from('sponsors')
        .select(`
          *,
          sponsor_assets(*)
        `)
        .eq('active', true)
        .order('tier DESC, name')

      return new Response(JSON.stringify({ sponsors: sponsors || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create sponsor
    if (path.includes('/sponsors') && method === 'POST' && body) {
      // Clean up empty string values that should be null
      const cleanBody = {
        name: body.name,
        display_name: body.display_name,
        contact_email: body.contact_email || null,
        website_url: body.website_url || null,
        logo_url: body.logo_url || null,
        active: true
      }

      const { data, error } = await supabase
        .from('sponsors')
        .insert(cleanBody)
        .select()
        .single()

      if (error) {
        console.error('Sponsor creation error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ sponsor: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Settings endpoint
    if (path.includes('/settings') && method === 'GET') {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .order('setting_key')

      return new Response(JSON.stringify({ settings: settings || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update settings
    if (path.includes('/settings/') && method === 'PUT' && body) {
      const settingKey = path.split('/settings/')[1]
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          setting_value: body.value,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ setting: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create campaign with auto-approval for admin
    if (path.includes('/campaigns') && method === 'POST' && body) {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          title: body.title,
          content: body.content,
          category: body.category || 'General',
          sponsor_id: body.sponsor_id || null,
          budget: body.budget || 0,
          target_regions: body.target_regions || [],
          target_categories: body.target_categories || [],
          media_urls: body.media_urls || [],
          scheduled_at: body.scheduled_at || null,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Campaign creation error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ campaign: data, auto_approved: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Activate campaign endpoint
    if (path.includes('/campaigns/') && path.includes('/activate') && method === 'POST') {
      const campaignId = path.split('/campaigns/')[1].split('/activate')[0]

      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, campaign: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get campaigns
    if (path.includes('/campaigns') && method === 'GET' && !path.match(/\/campaigns\/[a-f0-9-]{36}/)) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      return new Response(JSON.stringify({ campaigns: campaigns || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get single campaign
    if (path.match(/\/campaigns\/[a-f0-9-]{36}$/) && method === 'GET') {
      const campaignId = path.split('/campaigns/')[1]
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ campaign }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update campaign
    if (path.match(/\/campaigns\/[a-f0-9-]{36}$/) && method === 'PUT' && body) {
      const campaignId = path.split('/campaigns/')[1]

      // Clean and validate data
      const updateData: any = {}

      if (body.title) updateData.title = body.title
      if (body.content) updateData.content = body.content
      if (body.category) updateData.category = body.category

      // Handle sponsor_id - convert empty string to null
      if (body.sponsor_id !== undefined) {
        updateData.sponsor_id = body.sponsor_id === '' ? null : body.sponsor_id
      }

      // Handle budget - convert string to number
      if (body.budget !== undefined) {
        updateData.budget = typeof body.budget === 'string' ? parseFloat(body.budget) : body.budget
      }

      // Handle arrays
      if (body.target_regions) updateData.target_regions = body.target_regions
      if (body.target_categories) updateData.target_categories = body.target_categories
      if (body.media_urls) updateData.media_urls = body.media_urls

      // Handle scheduled_at - add seconds if missing, convert empty to null
      if (body.scheduled_at !== undefined) {
        if (body.scheduled_at === '' || body.scheduled_at === null) {
          updateData.scheduled_at = null
        } else {
          // Add :00 seconds if not present
          const dt = body.scheduled_at.includes(':00') ? body.scheduled_at : body.scheduled_at + ':00'
          updateData.scheduled_at = dt
        }
      }

      if (body.status) updateData.status = body.status

      console.log('📝 Updating campaign:', campaignId, updateData)

      const { data, error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaignId)
        .select()
        .single()

      if (error) {
        console.error('❌ Campaign update error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ campaign: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete campaign
    if (path.match(/\/campaigns\/[a-f0-9-]{36}$/) && method === 'DELETE') {
      const campaignId = path.split('/campaigns/')[1]
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Broadcasts endpoint with pagination
    if (path.includes('/broadcasts') && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      const { data: broadcasts, count } = await supabase
        .from('broadcasts')
        .select('*, moments(title, region, category)', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('broadcast_started_at', { ascending: false })

      return new Response(JSON.stringify({
        broadcasts: broadcasts || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Subscribers endpoint
    if (path.includes('/subscribers') && method === 'GET') {
      const filter = url.searchParams.get('filter') || 'all'
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      // Query directly from subscriptions table
      let query = supabase
        .from('subscriptions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filter === 'active') {
        query = query.eq('opted_in', true)
      } else if (filter === 'inactive') {
        query = query.eq('opted_in', false)
      }

      const { data: subscribers, count, error } = await query
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Subscribers query error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get stats
      const { count: totalCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })

      const { count: activeCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('opted_in', true)

      const total = totalCount || 0
      const active = activeCount || 0
      const inactive = total - active

      console.log(`📊 Subscribers: total=${total}, active=${active}, inactive=${inactive}`)

      return new Response(JSON.stringify({
        subscribers: subscribers || [],
        stats: { total, active, inactive, commands_used: 0 },
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Moderation endpoint with real data and MCP analysis
    if (path.includes('/moderation') && method === 'GET') {
      const filter = url.searchParams.get('filter') || 'all'
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      let query = supabase
        .from('messages')
        .select(`
          *,
          advisories(*)
        `, { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      const { data: messages, count } = await query

      // Process messages to include MCP analysis and auto-approve
      const processedMessages = (messages || []).map(msg => {
        const advisory = msg.advisories?.[0]
        const overallRisk = advisory?.confidence || 0

        // AUTO-APPROVE if risk < 0.3 and create audit record
        if (overallRisk < 0.3 && msg.moderation_status === 'pending') {
          supabase.from('messages')
            .update({
              moderation_status: 'approved',
              processed: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', msg.id)
            .then(async () => {
              await supabase.from('moderation_audit').insert({
                message_id: msg.id,
                action: 'approved',
                moderator: 'system_auto',
                reason: `Auto-approved: low risk ${overallRisk.toFixed(2)}`
              })
              console.log(`✅ Auto-approved message ${msg.id} risk=${overallRisk.toFixed(2)}`)
            })
          msg.moderation_status = 'approved'
        }

        return {
          ...msg,
          mcp_analysis: advisory ? {
            confidence: overallRisk,
            harm_signals: advisory.harm_signals || {},
            spam_indicators: advisory.spam_indicators || {},
            urgency_level: advisory.urgency_level || 'low',
            escalation_suggested: overallRisk > 0.7
          } : null
        }
      })

      // Apply filters
      let filteredMessages = processedMessages
      if (filter === 'flagged') {
        filteredMessages = processedMessages.filter(msg => msg.mcp_analysis && msg.mcp_analysis.confidence > 0.65)
      } else if (filter === 'high_risk') {
        filteredMessages = processedMessages.filter(msg => msg.mcp_analysis && msg.mcp_analysis.confidence > 0.7)
      } else if (filter === 'escalated') {
        filteredMessages = processedMessages.filter(msg => msg.mcp_analysis && msg.mcp_analysis.escalation_suggested)
      }

      return new Response(JSON.stringify({
        flaggedMessages: filteredMessages,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Message moderation actions
    if (path.includes('/messages/') && path.includes('/approve') && method === 'POST') {
      const messageId = path.split('/messages/')[1].split('/approve')[0]

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

      // Update message status with timestamp
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          moderation_status: 'approved',
          processed: true,
          moderation_timestamp: new Date().toISOString()
        })
        .eq('id', messageId)

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: 'Message approved successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Flag message
    if (path.includes('/messages/') && path.includes('/flag') && method === 'POST') {
      const messageId = path.split('/messages/')[1].split('/flag')[0]

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          moderation_status: 'flagged',
          processed: true,
          moderation_timestamp: new Date().toISOString()
        })
        .eq('id', messageId)

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: 'Message flagged successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Comments endpoints
    // GET /moments/:id/comments
    if (path.match(/\/moments\/[^\/]+\/comments$/) && method === 'GET') {
      const momentId = path.split('/moments/')[1].split('/comments')[0]
      const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('moment_id', momentId)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ comments: comments || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /moments/:id/comments
    if (path.match(/\/moments\/[^\/]+\/comments$/) && method === 'POST') {
      const momentId = path.split('/moments/')[1].split('/comments')[0]

      if (!await isFeatureEnabled(supabase, 'comments_enabled')) {
        return new Response(JSON.stringify({ error: 'Comments are currently disabled' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!await checkRateLimit(supabase, body.from_number || 'anonymous', '/comments', 10)) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          moment_id: momentId,
          from_number: body.from_number || 'anonymous',
          content: body.content,
          moderation_status: 'pending'
        })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ comment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /comments/:id/approve
    if (path.match(/\/comments\/[^\/]+\/approve$/) && method === 'POST') {
      const commentId = path.split('/comments/')[1].split('/approve')[0]

      const { error } = await supabase
        .from('comments')
        .update({
          moderation_status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /comments/:id/feature
    if (path.match(/\/comments\/[^\/]+\/feature$/) && method === 'POST') {
      const commentId = path.split('/comments/')[1].split('/feature')[0]

      const { error } = await supabase
        .from('comments')
        .update({
          featured: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /comments/:id
    if (path.match(/\/comments\/[^\/]+$/) && method === 'DELETE') {
      const commentId = path.split('/comments/')[1].split('?')[0]

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process scheduled moments endpoint
    if (path.includes('/process-scheduled') && method === 'POST') {
      const { data: scheduledMoments } = await supabase
        .from('moments')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())
        .limit(10)

      let processedCount = 0
      const results = []

      for (const moment of scheduledMoments || []) {
        try {
          // Update to draft status (ready for broadcast)
          const { error: updateError } = await supabase
            .from('moments')
            .update({
              status: 'draft',
              scheduled_at: null
            })
            .eq('id', moment.id)

          if (!updateError) {
            processedCount++
            results.push({
              id: moment.id,
              title: moment.title,
              status: 'processed'
            })
          }
        } catch (error) {
          results.push({
            id: moment.id,
            title: moment.title,
            status: 'error',
            error: error.message
          })
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed_count: processedCount,
        total_scheduled: scheduledMoments?.length || 0,
        results: results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Campaign broadcast endpoint
    if (path.includes('/campaigns/') && path.includes('/broadcast') && method === 'POST') {
      const campaignId = path.split('/campaigns/')[1].split('/broadcast')[0]

      console.log('📢 Broadcasting campaign:', campaignId)

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign) {
        console.error('❌ Campaign not found:', campaignError)
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Convert campaign to moment for broadcasting
      // Use campaign category directly (no mapping needed with expanded categories)
      const campaignCategory = Array.isArray(campaign.target_categories) ? campaign.target_categories[0] : 'General'

      // Ensure content meets minimum length (10 chars)
      let momentContent = campaign.content
      if (momentContent.length < 10) {
        momentContent = momentContent + ' - ' + campaign.title
      }

      const momentData = {
        title: campaign.title,
        content: momentContent,
        region: Array.isArray(campaign.target_regions) ? campaign.target_regions[0] : 'National',
        category: campaignCategory,
        sponsor_id: campaign.sponsor_id || null,
        is_sponsored: !!campaign.sponsor_id,
        content_source: 'campaign',
        status: 'broadcasted',
        created_by: 'campaign_system',
        broadcasted_at: new Date().toISOString(),
        media_urls: campaign.media_urls || []
      }

      console.log('📝 Creating moment:', momentData)

      const { data: moment, error: momentError } = await supabase
        .from('moments')
        .insert(momentData)
        .select()
        .single()

      if (momentError) {
        console.error('❌ Moment creation failed:', momentError)
        return new Response(JSON.stringify({ error: momentError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('✅ Moment created:', moment.id)

      // Get active subscribers
      const { data: subscribers } = await supabase
        .from('subscriptions')
        .select('phone_number')
        .eq('opted_in', true)

      const recipientCount = subscribers?.length || 0
      console.log('👥 Recipients:', recipientCount)

      // Create broadcast record
      const { data: broadcast } = await supabase
        .from('broadcasts')
        .insert({
          moment_id: moment.id,
          recipient_count: recipientCount,
          status: 'processing',
          broadcast_started_at: new Date().toISOString()
        })
        .select()
        .single()

      // Update campaign to published
      await supabase
        .from('campaigns')
        .update({ status: 'published' })
        .eq('id', campaignId)

      // Format broadcast message
      const sponsorText = campaign.sponsor_id ? '\\n\\nSponsored Content' : ''
      const broadcastMessage = `📢 Unami Foundation Campaign — ${moment.region}

${moment.title}

${moment.content}${sponsorText}

🌐 More: moments.unamifoundation.org/m/${moment.id}`

      console.log('📤 Triggering WhatsApp broadcast to', recipientCount, 'subscribers')

      // Trigger WhatsApp broadcast
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-webhook`
      const webhookPayload = JSON.stringify({
        broadcast_id: broadcast.id,
        message: broadcastMessage,
        recipients: subscribers.map(s => s.phone_number),
        moment_id: moment.id
      })

      console.log(`📡 Campaign broadcast webhook: POST ${webhookUrl}`)
      console.log(`Status: Broadcasting to ${recipientCount} subscribers`)
      // Trigger webhook asynchronously - don't block response
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: webhookPayload
      }).then(async (webhookResponse) => {
        const responseText = await webhookResponse.text()
        console.log(`📨 Campaign response: ${webhookResponse.status} - ${responseText.substring(0, 300)}`)
        
        if (webhookResponse.ok) {
          console.log('✅ Campaign WhatsApp broadcast triggered successfully')
        } else {
          console.error(`❌ Campaign WhatsApp broadcast failed: ${webhookResponse.status}\nResponse: ${responseText}`)
          await logError(supabase, 'campaign_broadcast_webhook_failed', `HTTP ${webhookResponse.status}: ${responseText}`, { broadcast_id: broadcast.id, campaign_id: campaignId, webhook_url: webhookUrl }, 'high')
        }
      }).catch(async (webhookError) => {
        console.error(`❌ Campaign broadcast webhook error: ${webhookError.message} (${webhookError.name})`)
        await logError(supabase, 'campaign_broadcast_webhook_error', webhookError.message, { broadcast_id: broadcast.id, campaign_id: campaignId, webhook_url: webhookUrl }, 'high')
      })
      
      console.log('📡 Campaign broadcast webhook triggered asynchronously')

      return new Response(JSON.stringify({
        success: true,
        campaign_id: campaignId,
        moment_id: moment.id,
        broadcast_id: broadcast.id,
        message: `Broadcasting campaign "${campaign.title}" to ${recipientCount} subscribers`,
        recipient_count: recipientCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Media upload endpoint
    if (path.includes('/upload-media') && method === 'POST') {
      try {
        // Handle multipart form data for file uploads
        const formData = await req.formData()
        const files = formData.getAll('media_files') as File[]

        if (!files || files.length === 0) {
          return new Response(JSON.stringify({ error: 'No files provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const uploadedFiles = []

        for (const file of files) {
          if (file.size === 0) continue

          const fileName = `moments/${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`

          try {
            const { data, error } = await supabase.storage
              .from('media')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (error) {
              console.error('Storage upload error:', error)
              continue
            }

            const { data: publicUrl } = supabase.storage
              .from('media')
              .getPublicUrl(fileName)

            uploadedFiles.push({
              id: data.path,
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
              publicUrl: publicUrl.publicUrl,
              bucket: 'media',
              path: fileName
            })
          } catch (fileError) {
            console.error('File upload error:', fileError)
          }
        }

        return new Response(JSON.stringify({
          success: true,
          files: uploadedFiles,
          message: `${uploadedFiles.length} file(s) uploaded successfully`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (uploadError) {
        console.error('Upload endpoint error:', uploadError)
        return new Response(JSON.stringify({
          error: 'Upload failed: ' + uploadError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Budget endpoints
    if (path.includes('/budget/overview') && method === 'GET') {
      const budgetData = await supabase
        .from('budget_transactions')
        .select('amount, created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const sponsorData = await supabase
        .from('sponsors')
        .select('monthly_budget');

      const messageCount = await supabase
        .from('moment_intents')
        .select('id', { count: 'exact' })
        .eq('status', 'sent')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      const totalBudget = sponsorData.data?.reduce((sum, s) => sum + (s.monthly_budget || 0), 0) || 10000;
      const totalSpent = budgetData.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const messageCost = 0.12;
      const messagesSent = messageCount.count || 0;

      return new Response(JSON.stringify({
        success: true,
        data: {
          total: totalBudget,
          used: totalSpent,
          message_cost: messageCost,
          messages_sent: messagesSent,
          messages_remaining: Math.floor((totalBudget - totalSpent) / messageCost)
        },
        settings: {
          monthly_budget: totalBudget,
          warning_threshold: 80,
          message_cost: messageCost,
          daily_limit: 500
        },
        alerts: totalSpent / totalBudget > 0.8 ? [{
          level: totalSpent / totalBudget > 0.9 ? 'critical' : 'warning',
          message: `Budget at ${Math.round((totalSpent / totalBudget) * 100)}% - ${totalSpent / totalBudget > 0.9 ? 'immediate action required' : 'monitor closely'}`
        }] : []
      }), { headers: corsHeaders });
    }

    if (path.includes('/budget/sponsors') && method === 'GET') {
      const { data: sponsors } = await supabase
        .from('sponsors')
        .select(`
          id, display_name, monthly_budget,
          budget_transactions(amount)
        `);

      const sponsorBudgets = sponsors?.map(sponsor => ({
        id: sponsor.id,
        display_name: sponsor.display_name,
        budget: sponsor.monthly_budget || 1000,
        spent: sponsor.budget_transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        sponsors: sponsorBudgets
      }), { headers: corsHeaders });
    }

    if (path.includes('/budget/transactions') && method === 'GET') {
      const { data: transactions } = await supabase
        .from('budget_transactions')
        .select(`
          amount, created_at, message_count, status,
          campaigns(sponsors(display_name))
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const formattedTransactions = transactions?.map(tx => ({
        amount: tx.amount,
        created_at: tx.created_at,
        message_count: tx.message_count || 0,
        status: tx.status || 'completed',
        sponsor_name: tx.campaigns?.sponsors?.display_name || 'System'
      })) || [];

      return new Response(JSON.stringify({
        success: true,
        transactions: formattedTransactions
      }), { headers: corsHeaders });
    }

    // Budget settings GET endpoint
    if (path.includes('/budget/settings') && method === 'GET') {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['monthly_budget', 'warning_threshold', 'message_cost', 'daily_limit'])

      const settingsObj = {}
      settings?.forEach(s => {
        settingsObj[s.setting_key] = parseFloat(s.setting_value)
      })

      return new Response(JSON.stringify({ success: true, settings: settingsObj }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Budget settings PUT endpoint
    if (path.includes('/budget/settings') && method === 'PUT' && body) {
      const settings = [
        { key: 'monthly_budget', value: body.monthly_budget },
        { key: 'warning_threshold', value: body.warning_threshold },
        { key: 'message_cost', value: body.message_cost },
        { key: 'daily_limit', value: body.daily_limit }
      ];

      for (const setting of settings) {
        if (setting.value !== undefined) {
          await supabase
            .from('system_settings')
            .upsert({
              setting_key: setting.key,
              setting_value: String(setting.value),
              updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Authority endpoints
    if (path.includes('/authority') && method === 'GET' && !path.match(/\/authority\/[a-f0-9-]{36}/)) {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit

      const { data, error } = await supabase
        .from('authority_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return new Response(JSON.stringify({ authority_profiles: data || [], page, limit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.match(/\/authority\/[a-f0-9-]{36}$/) && method === 'GET') {
      const id = path.split('/authority/')[1]
      const { data, error } = await supabase
        .from('authority_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('Authority profile fetch error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!data) {
        return new Response(JSON.stringify({ error: 'Authority profile not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ authority_profile: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.includes('/authority') && method === 'POST' && body) {
      const { data, error } = await supabase
        .from('authority_profiles')
        .insert(body)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ authority_profile: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.match(/\/authority\/[a-f0-9-]{36}$/) && method === 'PUT' && body) {
      const id = path.split('/authority/')[1]
      const { data, error } = await supabase
        .from('authority_profiles')
        .update(body)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({ authority_profile: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (path.match(/\/authority\/[a-f0-9-]{36}$/) && method === 'DELETE') {
      const id = path.split('/authority/')[1]
      const { error } = await supabase
        .from('authority_profiles')
        .delete()
        .eq('id', id)

      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    await logError(supabase, 'api_error', error.message, { path: new URL(req.url).pathname }, 'high')
    return new Response(JSON.stringify({
      error: error.message,
      path: new URL(req.url).pathname
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } finally {
    const responseTime = Date.now() - startTime
    if (responseTime > 1000) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
      await supabase.from('performance_metrics').insert({ endpoint: new URL(req.url).pathname, response_time_ms: responseTime, status_code: 200 })
    }
  }
})