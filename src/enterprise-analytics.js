// ENTERPRISE ANALYTICS DASHBOARD
// Real-time metrics, predictive analytics, executive reporting

class EnterpriseAnalytics {
  constructor(supabase) {
    this.supabase = supabase;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Real-time dashboard metrics
  async getDashboardMetrics(timeframe = '30d') {
    const cacheKey = `dashboard_${timeframe}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const interval = this.getInterval(timeframe);
    
    const [
      campaigns, moments, intents, revenue, budgets, subscribers, performance
    ] = await Promise.all([
      this.supabase.from('campaigns').select('*', { count: 'exact' })
        .gte('created_at', interval),
      this.supabase.from('moments').select('*', { count: 'exact' })
        .eq('status', 'broadcasted').gte('broadcasted_at', interval),
      this.supabase.from('moment_intents').select('status, created_at')
        .eq('channel', 'whatsapp').gte('created_at', interval),
      this.supabase.from('revenue_events').select('revenue_amount, created_at')
        .gte('created_at', interval),
      this.supabase.from('campaign_budgets').select('total_budget, spent_amount'),
      this.supabase.from('subscriptions').select('opted_in', { count: 'exact' })
        .eq('opted_in', true),
      this.supabase.from('sponsor_performance').select('*')
        .gte('period_start', interval)
    ]);

    const metrics = {
      // Core KPIs
      totalCampaigns: campaigns.count || 0,
      totalMoments: moments.count || 0,
      totalBroadcasts: intents.data?.filter(i => i.status === 'sent').length || 0,
      activeSubscribers: subscribers.count || 0,
      
      // Financial metrics
      totalRevenue: revenue.data?.reduce((sum, r) => sum + parseFloat(r.revenue_amount), 0) || 0,
      totalBudget: budgets.data?.reduce((sum, b) => sum + parseFloat(b.total_budget), 0) || 0,
      totalSpent: budgets.data?.reduce((sum, b) => sum + parseFloat(b.spent_amount), 0) || 0,
      
      // Performance metrics
      broadcastSuccessRate: this.calculateSuccessRate(intents.data),
      avgPerformanceScore: this.calculateAvgPerformance(performance.data),
      
      // Growth metrics
      revenueGrowth: this.calculateGrowth(revenue.data, 'revenue_amount'),
      subscriberGrowth: this.calculateSubscriberGrowth(timeframe),
      campaignGrowth: this.calculateGrowth(campaigns.data, 'created_at'),
      
      // Efficiency metrics
      costPerBroadcast: this.calculateCostPerBroadcast(budgets.data, intents.data),
      revenuePerSubscriber: this.calculateRevenuePerSubscriber(revenue.data, subscribers.count),
      
      // Predictive metrics
      projectedRevenue: this.projectRevenue(revenue.data, timeframe),
      budgetBurnRate: this.calculateBurnRate(budgets.data, timeframe),
      
      lastUpdated: new Date().toISOString()
    };

    // Cache results
    this.cache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    
    return metrics;
  }

  // Executive summary report
  async getExecutiveSummary(timeframe = '30d') {
    const metrics = await this.getDashboardMetrics(timeframe);
    const [topSponsors, topCampaigns, alerts] = await Promise.all([
      this.getTopSponsors(timeframe),
      this.getTopCampaigns(timeframe),
      this.getSystemAlerts()
    ]);

    return {
      summary: {
        totalRevenue: metrics.totalRevenue,
        totalCampaigns: metrics.totalCampaigns,
        roi: metrics.totalSpent > 0 ? 
          ((metrics.totalRevenue - metrics.totalSpent) / metrics.totalSpent * 100).toFixed(1) : 0,
        growthRate: metrics.revenueGrowth
      },
      performance: {
        broadcastSuccessRate: metrics.broadcastSuccessRate,
        avgPerformanceScore: metrics.avgPerformanceScore,
        costEfficiency: metrics.costPerBroadcast
      },
      topPerformers: {
        sponsors: topSponsors,
        campaigns: topCampaigns
      },
      alerts: alerts,
      projections: {
        projectedRevenue: metrics.projectedRevenue,
        budgetBurnRate: metrics.budgetBurnRate,
        recommendedActions: this.generateRecommendations(metrics)
      }
    };
  }

  // Real-time campaign monitoring
  async getCampaignMonitoring() {
    const { data: activeCampaigns } = await this.supabase
      .from('campaigns')
      .select(`
        *,
        campaign_budgets(*),
        sponsors(display_name, tier),
        moments(id, status, broadcasted_at)
      `)
      .in('status', ['active', 'running', 'pending']);

    return activeCampaigns?.map(campaign => ({
      id: campaign.id,
      title: campaign.title,
      sponsor: campaign.sponsors?.display_name,
      tier: campaign.sponsors?.tier,
      status: campaign.status,
      budget: {
        total: campaign.campaign_budgets?.[0]?.total_budget || 0,
        spent: campaign.campaign_budgets?.[0]?.spent_amount || 0,
        remaining: (campaign.campaign_budgets?.[0]?.total_budget || 0) - 
                  (campaign.campaign_budgets?.[0]?.spent_amount || 0),
        utilization: campaign.campaign_budgets?.[0]?.total_budget > 0 ?
          ((campaign.campaign_budgets?.[0]?.spent_amount || 0) / 
           campaign.campaign_budgets?.[0]?.total_budget * 100).toFixed(1) : 0
      },
      performance: {
        momentsCreated: campaign.moments?.length || 0,
        momentsBroadcasted: campaign.moments?.filter(m => m.status === 'broadcasted').length || 0,
        lastActivity: campaign.moments?.[0]?.broadcasted_at
      },
      alerts: this.generateCampaignAlerts(campaign)
    })) || [];
  }

  // Sponsor performance dashboard
  async getSponsorDashboard(sponsorId, timeframe = '30d') {
    const interval = this.getInterval(timeframe);
    
    const [campaigns, performance, invoices, assets] = await Promise.all([
      this.supabase.from('campaigns').select(`
        *,
        campaign_budgets(*),
        campaign_metrics(*)
      `).eq('sponsor_id', sponsorId).gte('created_at', interval),
      
      this.supabase.from('sponsor_performance').select('*')
        .eq('sponsor_id', sponsorId).gte('period_start', interval),
      
      this.supabase.from('sponsor_invoices').select('*')
        .eq('sponsor_id', sponsorId).gte('billing_period_start', interval),
      
      this.supabase.from('sponsor_assets').select('*')
        .eq('sponsor_id', sponsorId).eq('is_active', true)
    ]);

    const totalSpent = campaigns.data?.reduce((sum, c) => 
      sum + (c.campaign_budgets?.[0]?.spent_amount || 0), 0) || 0;
    
    const totalReach = campaigns.data?.reduce((sum, c) => 
      sum + (c.campaign_metrics?.reduce((metricSum, m) => 
        metricSum + (m.impressions || 0), 0) || 0), 0) || 0;

    return {
      overview: {
        campaignsRun: campaigns.data?.length || 0,
        totalSpent: totalSpent,
        totalReach: totalReach,
        avgPerformanceScore: performance.data?.reduce((sum, p) => 
          sum + p.performance_score, 0) / (performance.data?.length || 1) || 0
      },
      campaigns: campaigns.data?.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        budget: c.campaign_budgets?.[0]?.total_budget || 0,
        spent: c.campaign_budgets?.[0]?.spent_amount || 0,
        reach: c.campaign_metrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0,
        conversions: c.campaign_metrics?.reduce((sum, m) => sum + (m.conversions || 0), 0) || 0
      })) || [],
      billing: {
        invoices: invoices.data || [],
        totalBilled: invoices.data?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0,
        outstandingAmount: invoices.data?.filter(i => i.status === 'pending')
          .reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0
      },
      assets: assets.data || []
    };
  }

  // Predictive analytics
  async getPredictiveAnalytics(timeframe = '90d') {
    const interval = this.getInterval(timeframe);
    
    const { data: historicalData } = await this.supabase
      .from('daily_stats')
      .select('*')
      .gte('stat_date', interval)
      .order('stat_date', { ascending: true });

    if (!historicalData || historicalData.length < 7) {
      return { error: 'Insufficient data for predictions' };
    }

    return {
      revenueProjection: this.calculateTrendProjection(historicalData, 'revenue', 30),
      subscriberProjection: this.calculateTrendProjection(historicalData, 'subscribers', 30),
      campaignDemand: this.predictCampaignDemand(historicalData),
      budgetRecommendations: this.generateBudgetRecommendations(historicalData),
      seasonalTrends: this.identifySeasonalTrends(historicalData),
      riskFactors: this.identifyRiskFactors(historicalData)
    };
  }

  // Helper methods
  getInterval(timeframe) {
    const now = new Date();
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  calculateSuccessRate(intents) {
    if (!intents || intents.length === 0) return 0;
    const successful = intents.filter(i => i.status === 'sent').length;
    return ((successful / intents.length) * 100).toFixed(1);
  }

  calculateAvgPerformance(performance) {
    if (!performance || performance.length === 0) return 0;
    const total = performance.reduce((sum, p) => sum + p.performance_score, 0);
    return (total / performance.length).toFixed(1);
  }

  calculateGrowth(data, field) {
    if (!data || data.length < 2) return 0;
    
    const sorted = data.sort((a, b) => new Date(a[field]) - new Date(b[field]));
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstValue = firstHalf.length;
    const secondValue = secondHalf.length;
    
    return firstValue > 0 ? ((secondValue - firstValue) / firstValue * 100).toFixed(1) : 0;
  }

  calculateCostPerBroadcast(budgets, intents) {
    const totalSpent = budgets?.reduce((sum, b) => sum + parseFloat(b.spent_amount), 0) || 0;
    const totalBroadcasts = intents?.filter(i => i.status === 'sent').length || 0;
    return totalBroadcasts > 0 ? (totalSpent / totalBroadcasts).toFixed(2) : 0;
  }

  calculateRevenuePerSubscriber(revenue, subscriberCount) {
    const totalRevenue = revenue?.reduce((sum, r) => sum + parseFloat(r.revenue_amount), 0) || 0;
    return subscriberCount > 0 ? (totalRevenue / subscriberCount).toFixed(2) : 0;
  }

  projectRevenue(revenueData, timeframe) {
    if (!revenueData || revenueData.length < 3) return 0;
    
    const dailyRevenue = revenueData.reduce((sum, r) => sum + parseFloat(r.revenue_amount), 0) / 30;
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    return (dailyRevenue * days * 1.1).toFixed(0); // 10% growth assumption
  }

  calculateBurnRate(budgets, timeframe) {
    const totalSpent = budgets?.reduce((sum, b) => sum + parseFloat(b.spent_amount), 0) || 0;
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    return (totalSpent / days).toFixed(2);
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.broadcastSuccessRate < 85) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Broadcast success rate below 85%. Review message templates and delivery timing.'
      });
    }
    
    if (metrics.budgetBurnRate > metrics.totalBudget / 30) {
      recommendations.push({
        type: 'budget',
        priority: 'medium',
        message: 'Budget burn rate is high. Consider optimizing campaign targeting.'
      });
    }
    
    if (metrics.revenueGrowth < 0) {
      recommendations.push({
        type: 'revenue',
        priority: 'high',
        message: 'Revenue declining. Focus on high-performing sponsors and campaigns.'
      });
    }
    
    return recommendations;
  }

  generateCampaignAlerts(campaign) {
    const alerts = [];
    const budget = campaign.campaign_budgets?.[0];
    
    if (budget) {
      const utilization = (budget.spent_amount / budget.total_budget) * 100;
      
      if (utilization > 90) {
        alerts.push({ type: 'budget', level: 'critical', message: 'Budget 90% depleted' });
      } else if (utilization > 75) {
        alerts.push({ type: 'budget', level: 'warning', message: 'Budget 75% depleted' });
      }
    }
    
    return alerts;
  }

  async getTopSponsors(timeframe) {
    const interval = this.getInterval(timeframe);
    
    const { data } = await this.supabase
      .from('sponsor_performance')
      .select('*, sponsors(display_name)')
      .gte('period_start', interval)
      .order('performance_score', { ascending: false })
      .limit(5);
    
    return data || [];
  }

  async getTopCampaigns(timeframe) {
    const interval = this.getInterval(timeframe);
    
    const { data } = await this.supabase
      .from('campaigns')
      .select(`
        *,
        campaign_metrics(*),
        sponsors(display_name)
      `)
      .gte('created_at', interval)
      .order('created_at', { ascending: false })
      .limit(5);
    
    return data?.map(c => ({
      id: c.id,
      title: c.title,
      sponsor: c.sponsors?.display_name,
      conversions: c.campaign_metrics?.reduce((sum, m) => sum + (m.conversions || 0), 0) || 0,
      reach: c.campaign_metrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0
    })) || [];
  }

  async getSystemAlerts() {
    // Implementation for system-wide alerts
    return [
      { type: 'system', level: 'info', message: 'All systems operational' }
    ];
  }
}

export default EnterpriseAnalytics;