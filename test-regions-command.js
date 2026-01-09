#!/usr/bin/env node

// Test script to verify regions command functionality
import { handleWebhook } from './src/webhook.js';

// Mock request for HELP command
const helpRequest = {
  body: {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: 'test-help-123',
            from: '27123456789',
            type: 'text',
            text: { body: 'help' }
          }]
        }
      }]
    }]
  }
};

// Mock request for REGIONS command
const regionsRequest = {
  body: {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: 'test-regions-123',
            from: '27123456789',
            type: 'text',
            text: { body: 'regions' }
          }]
        }
      }]
    }]
  }
};

// Mock request for region selection
const regionSelectionRequest = {
  body: {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: 'test-selection-123',
            from: '27123456789',
            type: 'text',
            text: { body: 'KZN WC GP' }
          }]
        }
      }]
    }]
  }
};

// Mock response object
const mockResponse = {
  status: (code) => ({
    json: (data) => console.log(`Response ${code}:`, data),
    send: (data) => console.log(`Response ${code}:`, data)
  })
};

console.log('🧪 Testing WhatsApp Commands...\n');

console.log('1. Testing HELP command:');
await handleWebhook(helpRequest, mockResponse);

console.log('\n2. Testing REGIONS command:');
await handleWebhook(regionsRequest, mockResponse);

console.log('\n3. Testing region selection (KZN WC GP):');
await handleWebhook(regionSelectionRequest, mockResponse);

console.log('\n✅ Test completed. Check console output above for command responses.');