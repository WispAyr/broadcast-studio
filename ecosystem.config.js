module.exports = {
  apps: [{
    name: 'broadcast-studio',
    cwd: '/root/broadcast-studio/server',
    script: 'src/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3945,
      PRISM_BASE: 'https://live.wispayr.online',
      PRISM_API_PREFIX: '/api/prism',
      SURFACE_SIGNING_KEY: 'MFWaMqBylpzcO_shIuUOZFT2iBxs6xOsW5q6J4mcuQ1F96Zc1DZD31bqZgMk90oR'
    },
    restart_delay: 3000,
    max_restarts: 10
  }]
};
