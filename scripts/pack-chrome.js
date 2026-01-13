const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '../dist');
const outputDir = path.resolve(__dirname, '../web-ext-artifacts/chrome');
const zipFile = path.join(outputDir, 'chrome-extension.zip');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Remove existing zip if it exists
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

// Create zip file
try {
  if (process.platform === 'win32') {
    // Windows: Use PowerShell
    execSync(`powershell Compress-Archive -Path "${distDir}\\*" -DestinationPath "${zipFile}" -Force`, { stdio: 'inherit' });
  } else {
    // Linux/Mac: Use zip command
    execSync(`cd "${distDir}" && zip -r "${zipFile}" . -x '*.map'`, { stdio: 'inherit' });
  }
  console.log(`\n✅ Chrome extension packed successfully: ${zipFile}`);
} catch (error) {
  console.error('\n❌ Failed to create zip file.');
  if (process.platform === 'win32') {
    console.error('   Please ensure PowerShell is available.');
    console.error(`   Or manually run: Compress-Archive -Path "${distDir}\\*" -DestinationPath "${zipFile}"`);
  } else {
    console.error('   Please install zip utility: sudo apt-get install zip (Ubuntu/Debian) or brew install zip (Mac)');
    console.error(`   Or manually run: cd "${distDir}" && zip -r "${zipFile}" . -x '*.map'`);
  }
  process.exit(1);
}
