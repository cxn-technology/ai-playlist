/** PM2: runs `bun start` (next start). Matches Caddy zipdj.atechhub247.com → localhost:3000 */
module.exports = {
  apps: [
    {
      name: 'zipdj',
      cwd: __dirname,
      script: 'bun',
      args: 'start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
