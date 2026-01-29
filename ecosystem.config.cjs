// PM2 Ecosystem Configuration for Luc Vincent VIP App
// https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: "lv-vip-app",
      script: "npm",
      args: "run start",
      cwd: "/var/www/lv-vip-app",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/lv-vip-app-error.log",
      out_file: "/var/log/pm2/lv-vip-app-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
