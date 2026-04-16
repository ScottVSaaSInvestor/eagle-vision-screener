module.exports = {
  apps: [
    {
      name: 'eagle-vision-vite',
      script: 'npx',
      args: 'vite --port 5173 --host 0.0.0.0',
      cwd: '/home/user/eagle-vision-screener',
      env: { NODE_ENV: 'development', PORT: 5173 },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
