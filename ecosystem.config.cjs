module.exports = {
  apps: [
    {
      name: 'nutralogos',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      env_production: { NODE_ENV: 'production' },
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
      user: 'appuser',
      host: 'amster_app',
      ref: 'origin/main',
      repo: 'git@github.com:RaufERK/nutralogos.git',
      path: '/home/appuser/apps/nutralogos',
      'pre-deploy-local': '',
      'post-deploy': [
        'source ~/.nvm/nvm.sh && nvm use --lts',
        'ln -sf /home/appuser/shared/nutralogos/.env.production ./.env.production || true',
        'npm ci --include=dev',
        'npm run build',
        'npx pm2 update',
        'npx pm2 startOrReload ecosystem.config.cjs --env production',
        'npx pm2 save',
      ].join(' && '),
      env: { NODE_ENV: 'production' },
    },
  },
}
