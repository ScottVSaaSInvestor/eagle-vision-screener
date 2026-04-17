module.exports = {
  apps: [
    {
      name: 'perch',
      script: 'node',
      args: 'serve.mjs',
      cwd: '/home/user/eagle-vision-screener',
      env: { NODE_ENV: 'production' },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
