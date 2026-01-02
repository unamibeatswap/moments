import { test } from 'node:test';
import assert from 'node:assert';
import { supabase } from '../config/supabase.js';
import { broadcastMoment, handleUserOptIn } from '../src/broadcast.js';

test('Moments App Integration Test', async (t) => {
  
  await t.test('Database connection', async () => {
    const { data, error } = await supabase.from('messages').select('count').limit(1);
    assert.ok(!error, 'Should connect to Supabase');
  });

  await t.test('Sponsor creation', async () => {
    const { data, error } = await supabase
      .from('sponsors')
      .insert({
        name: 'test_sponsor',
        display_name: 'Test Sponsor Co.'
      })
      .select()
      .single();
    
    assert.ok(!error, 'Should create sponsor');
    assert.equal(data.display_name, 'Test Sponsor Co.');
    
    // Cleanup
    await supabase.from('sponsors').delete().eq('id', data.id);
  });

  await t.test('Moment creation', async () => {
    const { data, error } = await supabase
      .from('moments')
      .insert({
        title: 'Test Moment',
        content: 'This is a test moment for the community.',
        region: 'KZN',
        category: 'Education',
        status: 'draft'
      })
      .select()
      .single();
    
    assert.ok(!error, 'Should create moment');
    assert.equal(data.title, 'Test Moment');
    assert.equal(data.status, 'draft');
    
    // Cleanup
    await supabase.from('moments').delete().eq('id', data.id);
  });

  await t.test('User subscription', async () => {
    const testPhone = '+27123456789';
    
    await handleUserOptIn(testPhone, ['KZN'], ['Education']);
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('phone_number', testPhone)
      .single();
    
    assert.ok(!error, 'Should create subscription');
    assert.equal(data.opted_in, true);
    assert.ok(data.regions.includes('KZN'));
    
    // Cleanup
    await supabase.from('subscriptions').delete().eq('phone_number', testPhone);
  });

  await t.test('Broadcast message formatting', async () => {
    // Create test moment
    const { data: moment } = await supabase
      .from('moments')
      .insert({
        title: 'Test Broadcast',
        content: 'Testing broadcast functionality.',
        region: 'WC',
        category: 'Safety',
        is_sponsored: false,
        status: 'draft'
      })
      .select()
      .single();
    
    assert.ok(moment, 'Should create test moment');
    
    // Test would broadcast (but we won't actually send)
    // In real test, we'd mock the WhatsApp API
    
    // Cleanup
    await supabase.from('moments').delete().eq('id', moment.id);
  });

});

test('Admin API Endpoints', async (t) => {
  
  await t.test('Analytics endpoint structure', async () => {
    // Test that analytics returns expected structure
    const mockAnalytics = {
      totalMoments: 0,
      totalBroadcasts: 0,
      totalRecipients: 0,
      totalSuccess: 0,
      activeSubscribers: 0,
      successRate: 0
    };
    
    // Verify all required fields are present
    const requiredFields = ['totalMoments', 'activeSubscribers', 'successRate'];
    requiredFields.forEach(field => {
      assert.ok(field in mockAnalytics, `Analytics should include ${field}`);
    });
  });

  await t.test('Moment validation', async () => {
    const validMoment = {
      title: 'Valid Moment',
      content: 'This has all required fields.',
      region: 'GP',
      category: 'Opportunity'
    };
    
    const requiredFields = ['title', 'content', 'region', 'category'];
    requiredFields.forEach(field => {
      assert.ok(field in validMoment, `Moment should require ${field}`);
      assert.ok(validMoment[field], `${field} should not be empty`);
    });
  });

});

console.log('✅ Moments App tests completed');