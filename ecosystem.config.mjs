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


