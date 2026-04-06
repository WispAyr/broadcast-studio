module.exports = {
  apps: [{
    name: 'broadcast-studio',
    cwd: '/root/broadcast-studio/server',
    script: 'src/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3945
    },
    restart_delay: 3000,
    max_restarts: 10
  }]
};
