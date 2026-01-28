const { execSync } = require('child_process');
const path = require('path');

const isProd = process.argv.includes('--prod');
const projectRoot = path.resolve(__dirname, '..');

const webpackCmd = isProd
  ? 'webpack --config webpack.config.chrome.js --mode=production'
  : 'webpack --config webpack.config.chrome.js';

try {
  execSync(webpackCmd, { stdio: 'inherit', cwd: projectRoot });
  require('./pack-chrome.js');
} catch (error) {
  process.exit(1);
}
