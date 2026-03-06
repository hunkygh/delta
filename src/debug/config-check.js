// Temporary config checker
console.log('🔍 Checking Supabase configuration...');

// Test if we can import the config
try {
  const config = require('../config/supabase-config.js');
  console.log('✅ Config loaded:', {
    supabaseUrl: config.supabaseUrl ? 'SET' : 'MISSING',
    supabaseAnonKey: config.supabaseAnonKey ? 'SET' : 'MISSING',
    urlLength: config.supabaseUrl?.length || 0,
    keyLength: config.supabaseAnonKey?.length || 0
  });
  
  // Test URL format
  if (config.supabaseUrl) {
    console.log('🔍 URL format check:', config.supabaseUrl.startsWith('https://') ? '✅ HTTPS' : '❌ Not HTTPS');
    console.log('🔍 URL domain check:', config.supabaseUrl.includes('.supabase.co') ? '✅ Supabase domain' : '❌ Not Supabase domain');
  }
  
} catch (error) {
  console.error('❌ Failed to load config:', error);
}
