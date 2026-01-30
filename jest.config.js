/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js'],
  transform: { '^.+\\.js$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/(?!jszip)/'],
};
