import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seedSponsors() {
  const sponsors = [
    {
      name: 'unami_foundation',
      display_name: 'Unami Foundation',
      contact_email: 'info@unamifoundation.org',
      tier: 'platinum',
      active: true
    },
    {
      name: 'local_business_network',
      display_name: 'Local Business Network',
      contact_email: 'contact@localbusiness.co.za',
      tier: 'gold',
      active: true
    },
    {
      name: 'community_partners',
      display_name: 'Community Partners SA',
      contact_email: 'hello@communitypartners.org.za',
      tier: 'silver',
      active: true
    }
  ];

  console.log('Creating sponsors...\n');

  for (const sponsor of sponsors) {
    const { data, error } = await supabase
      .from('sponsors')
      .upsert(sponsor, { onConflict: 'name' })
      .select();

    if (error) {
      console.log(`❌ Error creating ${sponsor.display_name}:`, error.message);
    } else {
      console.log(`✅ Created: ${sponsor.display_name} (${sponsor.tier})`);
    }
  }

  // Verify
  const { data: allSponsors } = await supabase
    .from('sponsors')
    .select('*')
    .eq('active', true);

  console.log(`\n✅ Total active sponsors: ${allSponsors?.length || 0}`);
}

seedSponsors().catch(console.error);
