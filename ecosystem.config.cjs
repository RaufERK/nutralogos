module.exports = {
  apps: [
    {
      name: 'nutralogos-next',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' }
    },
    {
      name: 'nutralogos-ws',
      script: 'websocket-server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: '3001',
        WEBSOCKET_HTTP_PORT: '3002'
      },
      env_production: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: '3001',
        WEBSOCKET_HTTP_PORT: '3002'
      }
    }
  ],

  deploy: {
    production: {
      user: 'appuser',
      host: '185.200.178.73',                    // или твой ssh-алиас
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_ORG/YOUR_REPO.git',
      path: '/home/appuser/apps/nutralogos',     // PM2 создаст releases/ и current
      'pre-deploy-local': '',
      'post-deploy': [
        'source ~/.nvm/nvm.sh && nvm use --lts',
        // shared .env (см. шаги ниже)
        'ln -sf /home/appuser/shared/nutralogos/.env.production ./.env.production || true',
        'npm ci',
        'npm run build',
        'pm2 startOrReload ecosystem.config.cjs --env production',
        'pm2 save'
      ].join(' && '),
      env: { NODE_ENV: 'production' }
    }
  }
};
