module.exports = {
  apps: [
    {
      name: "yt-abtest-web",
      script: "python",
      args: "-m app.main web",
      cwd: "C:/Users/jp_bu/yt-thumbnail-abtest",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      log_file: "./logs/pm2-web-combined.log",
      out_file: "./logs/pm2-web-out.log",
      error_file: "./logs/pm2-web-error.log",
      env: {
        PYTHONPATH: ".",
      },
    },
  ],
};
