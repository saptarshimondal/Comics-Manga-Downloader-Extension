const { execSync } = require('child_process');
const path = require('path');

const isProd = process.argv.includes('--prod');
const isListed = process.argv.includes('--listed');
const projectRoot = path.resolve(__dirname, '..');

const webpackCmd = isProd
  ? 'webpack --config webpack.config.js --mode=production'
  : 'webpack --config webpack.config.js';
const webExtCmd =
  'web-ext build --overwrite-dest --source-dir ./dist --artifacts-dir ./web-ext-artifacts/firefox';

try {
  execSync(webpackCmd, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: {
      ...process.env,
      LISTED: isListed ? '1' : '',
    },
  });

  execSync(webExtCmd, { stdio: 'inherit', cwd: projectRoot });
} catch (error) {
  process.exit(1);
}
