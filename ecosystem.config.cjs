module.exports = {
  apps: [
    {
      name: 'nutralogos-next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'nutralogos-ws',
      script: 'websocket-server.js',
      cwd: __dirname,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        WEBSOCKET_PORT: '3001',
        WEBSOCKET_HTTP_PORT: '3002',
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: '3001',
        WEBSOCKET_HTTP_PORT: '3002',
      },
    },
  ],
  deploy: {
    production: {
      user: 'YOUR_SSH_USER',
      host: 'YOUR_SERVER_HOST',
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_ORG/YOUR_REPO.git',
      path: '/var/www/nutralogos',
      'pre-deploy-local': '',
      'post-deploy': [
        'mkdir -p data',
        'npm ci',
        'npm run build',
        'npm run seed',
        'pm2 startOrReload ecosystem.config.cjs --env production',
        'pm2 save',
      ].join(' && '),
      env: {
        NODE_ENV: 'production',
      },
    },
  },
}

module.exports = {
  apps: [
    {
      name: 'nutralogos-next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'nutralogos-ws',
      script: 'websocket-server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: '3001',
        WEBSOCKET_HTTP_PORT: '3002',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
}
