// WhatsApp Marketing Templates - Meta Approved
// Updated: January 2026 - Switched from UTILITY to MARKETING category

export const TEMPLATE_CATEGORIES = {
  MARKETING: 'MARKETING',
  AUTHENTICATION: 'AUTHENTICATION'
};

// Marketing-compliant templates for verified authority sources
export const MARKETING_TEMPLATES = {
  
  // Standard moment from verified authority
  VERIFIED_MOMENT: {
    name: 'verified_moment_v1',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '✓ Verified Update — {{1}}'
      },
      {
        type: 'BODY',
        text: '{{2}}\n\n{{3}}\n\n🏷️ {{4}} • 📍 {{5}}\n\nFrom: {{6}}\n\n🌐 More: {{7}}'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe'
      }
    ],
    parameters: ['region', 'title', 'content', 'category', 'region', 'institution_name', 'dynamic_link']
  },

  // Sponsored moment from verified authority
  VERIFIED_SPONSORED_MOMENT: {
    name: 'verified_sponsored_v1',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '✓ Partner Content — {{1}}'
      },
      {
        type: 'BODY',
        text: '{{2}}\n\n{{3}}\n\n🏷️ {{4}} • 📍 {{5}}\n\nVerified by: {{6}}\nIn partnership with: {{7}}\n\n🌐 More: {{8}}'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe'
      }
    ],
    parameters: ['region', 'title', 'content', 'category', 'region', 'institution_name', 'sponsor_name', 'dynamic_link']
  },

  // Community moment (no authority)
  COMMUNITY_MOMENT: {
    name: 'community_moment_v1',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '📢 Community Report — {{1}}'
      },
      {
        type: 'BODY',
        text: '{{2}}\n\nShared by community member for awareness.\n\n🏷️ {{3}} • 📍 {{4}}\n\n🌐 Full details: {{5}}'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe'
      }
    ],
    parameters: ['region', 'title', 'category', 'region', 'dynamic_link']
  },

  // High authority moment (Level 4-5)
  OFFICIAL_ANNOUNCEMENT: {
    name: 'official_announcement_v1',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '🏛️ Official Announcement — {{1}}'
      },
      {
        type: 'BODY',
        text: '{{2}}\n\n{{3}}\n\n🏷️ {{4}} • 📍 {{5}}\n\nIssued by: {{6}}\n\n🌐 More: {{7}}'
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe'
      }
    ],
    parameters: ['region', 'title', 'content', 'category', 'region', 'institution_name', 'dynamic_link']
  },

  // Welcome message (MARKETING category)
  WELCOME_SUBSCRIPTION: {
    name: 'welcome_subscription_v2',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Welcome to Unami Foundation Moments! 🌟\n\nYou\'re subscribed to community updates for {{1}}.\n\nCategories: {{2}}\n\nReply STOP anytime to unsubscribe.'
      },
      {
        type: 'FOOTER',
        text: 'Unami Foundation - Empowering Communities'
      }
    ],
    parameters: ['region', 'categories']
  },

  // Unsubscribe confirmation (MARKETING category)
  UNSUBSCRIBE_CONFIRM: {
    name: 'unsubscribe_confirm_v2',
    category: TEMPLATE_CATEGORIES.MARKETING,
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'You have been unsubscribed from Unami Foundation Moments.\n\nReply START anytime to resubscribe.\n\nThank you for being part of our community! 🙏'
      }
    ],
    parameters: []
  }
};

// Template selector - campaigns use sponsor presence, WhatsApp moments use authority
export function selectTemplate(moment, authorityContext, sponsor = null) {
  // For WhatsApp-submitted moments: Use authority-based selection
  if (authorityContext) {
    // High authority (Level 4-5) - Official announcements
    if (authorityContext.authority_level >= 4) {
      return MARKETING_TEMPLATES.OFFICIAL_ANNOUNCEMENT;
    }
    
    // Verified authority with sponsor
    if (sponsor) {
      return MARKETING_TEMPLATES.VERIFIED_SPONSORED_MOMENT;
    }
    
    // Verified authority without sponsor
    return MARKETING_TEMPLATES.VERIFIED_MOMENT;
  }
  
  // For admin campaigns: Use sponsor presence only
  if (sponsor) {
    return MARKETING_TEMPLATES.VERIFIED_SPONSORED_MOMENT;
  }
  
  // Community content (no authority, no sponsor)
  return MARKETING_TEMPLATES.COMMUNITY_MOMENT;
}

// Build dynamic link with tracking
function buildDynamicLink(moment, authorityContext) {
  const baseUrl = moment.pwa_link || 'https://moments.unamifoundation.org';
  const params = new URLSearchParams({
    m: moment.id,
    r: moment.region
  });
  return `${baseUrl}?${params.toString()}`;
}

// Build template parameters based on authority
export function buildTemplateParams(moment, authorityContext, sponsor = null) {
  const template = selectTemplate(moment, authorityContext, sponsor);
  const dynamicLink = buildDynamicLink(moment, authorityContext);
  const institutionName = authorityContext?.role_label || 'Community Member';
  
  switch (template.name) {
    case 'official_announcement_v1':
      return [
        moment.region,
        moment.title,
        moment.content.substring(0, 200),
        moment.category,
        moment.region,
        institutionName,
        dynamicLink
      ];
      
    case 'verified_sponsored_v1':
      return [
        moment.region,
        moment.title,
        moment.content.substring(0, 180),
        moment.category,
        moment.region,
        institutionName,
        sponsor.display_name,
        dynamicLink
      ];
      
    case 'verified_moment_v1':
      return [
        moment.region,
        moment.title,
        moment.content.substring(0, 200),
        moment.category,
        moment.region,
        institutionName,
        dynamicLink
      ];
      
    case 'community_moment_v1':
      return [
        moment.region,
        moment.title,
        moment.category,
        moment.region,
        dynamicLink
      ];
      
    case 'welcome_subscription_v2':
      return [moment.region, moment.categories?.join(', ') || 'All'];
      
    case 'unsubscribe_confirm_v2':
      return [];
      
    default:
      return [];
  }
}

// Marketing compliance validator
export function validateMarketingCompliance(moment, template, params) {
  const compliance = {
    sponsor_disclosed: false,
    opt_out_included: false,
    pwa_link_included: false,
    template_category: template.category,
    compliance_score: 0
  };
  
  // Check sponsor disclosure
  if (moment.is_sponsored && params.includes(moment.sponsors?.display_name)) {
    compliance.sponsor_disclosed = true;
  }
  
  // Check opt-out language
  const hasOptOut = template.components.some(c => 
    c.text?.includes('STOP') || c.text?.includes('unsubscribe')
  );
  compliance.opt_out_included = hasOptOut;
  
  // Check PWA link
  const hasPWALink = template.components.some(c => 
    c.text?.includes('moments.unamifoundation.org')
  );
  compliance.pwa_link_included = hasPWALink;
  
  // Calculate compliance score
  compliance.compliance_score = 
    (compliance.sponsor_disclosed ? 40 : 0) +
    (compliance.opt_out_included ? 30 : 0) +
    (compliance.pwa_link_included ? 30 : 0);
  
  return compliance;
}
