#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkCategoryConstraints() {
  console.log('🔍 Checking Category Constraints\n');
  
  // Test each category to see which ones work
  const testCategories = [
    'Education', 'Safety', 'Culture', 'Opportunity', 'Events', 'Health', 'Technology',
    'Community', 'education', 'EDUCATION'
  ];
  
  for (const category of testCategories) {
    try {
      const { data, error } = await supabase
        .from('moments')
        .insert({
          title: 'Test',
          content: 'Test content',
          region: 'GP',
          category: category,
          created_by: 'test'
        })
        .select()
        .single();
      
      if (error) {
        console.log(`❌ Category "${category}" failed:`, error.message);
      } else {
        console.log(`✅ Category "${category}" works`);
        // Clean up
        await supabase.from('moments').delete().eq('id', data.id);
      }
    } catch (err) {
      console.log(`❌ Category "${category}" error:`, err.message);
    }
  }
  
  // Also test regions
  console.log('\n🌍 Testing Regions...');
  const testRegions = ['KZN', 'WC', 'GP', 'National', 'EC', 'FS'];
  
  for (const region of testRegions) {
    try {
      const { data, error } = await supabase
        .from('moments')
        .insert({
          title: 'Test',
          content: 'Test content',
          region: region,
          category: 'Events',
          created_by: 'test'
        })
        .select()
        .single();
      
      if (error) {
        console.log(`❌ Region "${region}" failed:`, error.message);
      } else {
        console.log(`✅ Region "${region}" works`);
        // Clean up
        await supabase.from('moments').delete().eq('id', data.id);
      }
    } catch (err) {
      console.log(`❌ Region "${region}" error:`, err.message);
    }
  }
}

checkCategoryConstraints().catch(console.error);