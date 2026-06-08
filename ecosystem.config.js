
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'manutencao-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/src/main.js', // o build gera dist/src/ (por causa do prisma.config.ts na raiz)
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'manutencao-front',
      cwd: path.join(__dirname, 'frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
