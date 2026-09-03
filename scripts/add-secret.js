const cp = require('child_process');
const p = cp.spawn('npx.cmd', ['vercel', 'env', 'add', 'CRON_SECRET', 'production'], {
  stdio: ['pipe', 'inherit', 'inherit']
});
p.stdin.write('test-cron-secret-1234');
p.stdin.end();
