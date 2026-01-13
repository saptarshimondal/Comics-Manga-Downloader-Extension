const { execSync } = require('child_process');

console.log('🚀 Building and packing for both Firefox and Chrome...\n');

try {
  // Build and pack Firefox
  console.log('📦 Building Firefox extension...');
  execSync('npm run pack:firefox', { stdio: 'inherit' });
  console.log('\n✅ Firefox extension packed successfully!\n');

  // Build and pack Chrome
  console.log('📦 Building Chrome extension...');
  execSync('npm run pack:chrome', { stdio: 'inherit' });
  console.log('\n✅ Chrome extension packed successfully!\n');

  console.log('🎉 All extensions packed successfully!');
  console.log('   Firefox: web-ext-artifacts/firefox/');
  console.log('   Chrome: web-ext-artifacts/chrome/chrome-extension.zip');
} catch (error) {
  console.error('\n❌ Error building extensions:', error.message);
  process.exit(1);
}
