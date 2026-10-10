module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  env: {
    browser: true,
    es2021: true,
  },
  rules: {
    'react/no-unescaped-entities': 'off',
  },
};
