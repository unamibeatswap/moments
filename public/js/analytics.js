// Unami Foundation Moments - Privacy-First Analytics
class UnamiAnalytics {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.events = [];
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Track page views (no personal data)
  trackPageView(page) {
    this.track('page_view', { page, timestamp: Date.now() });
  }

  // Track user interactions (aggregated only)
  trackEvent(action, category = 'general') {
    this.track('user_action', { action, category, timestamp: Date.now() });
  }

  // Track performance metrics
  trackPerformance() {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0];
      this.track('performance', {
        loadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
        timestamp: Date.now()
      });
    }
  }

  // Internal tracking (privacy-compliant)
  track(eventType, data) {
    const event = {
      type: eventType,
      sessionId: this.sessionId,
      data: data,
      userAgent: navigator.userAgent.split(' ')[0], // Browser only
      timestamp: Date.now()
    };

    this.events.push(event);
    
    // Send to server periodically (no personal data)
    if (this.events.length >= 10) {
      this.flush();
    }
  }

  // Send analytics data (aggregated, anonymous)
  async flush() {
    if (this.events.length === 0) return;

    try {
      await fetch('https://xvwzuhnbxuffpglkqaht.supabase.co/functions/v1/public-api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: this.events,
          sessionDuration: Date.now() - this.startTime
        })
      });
      this.events = [];
    } catch (error) {
      // Fail silently - analytics shouldn't break functionality
    }
  }

  // Auto-flush on page unload
  init() {
    // Track initial page load
    this.trackPageView(window.location.pathname);
    this.trackPerformance();

    // Track clicks on important elements
    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn, .nav button, [data-action]')) {
        this.trackEvent('click', e.target.className || 'button');
      }
    });

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Periodic flush
    setInterval(() => this.flush(), 30000); // Every 30 seconds
  }
}

// Initialize analytics (privacy-first)
const analytics = new UnamiAnalytics();
analytics.init();