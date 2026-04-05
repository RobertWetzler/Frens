#!/usr/bin/env node
/**
 * Starts the Expo web dev server with an HTTPS (SSL) proxy for LAN development.
 * This ensures the frontend is accessible over HTTPS from any device on the network,
 * which is required for testing PWA features (service workers, install prompts, etc.).
 *
 * Flow:
 *   1. Detects LAN IP
 *   2. Writes dev-ip.generated.js pointing to the ASP.NET HTTPS endpoint
 *   3. Starts local-ssl-proxy (HTTPS :8443 → HTTP :8081) using the self-signed LAN cert
 *   4. Starts Expo Metro bundler with --host lan
 *
 * Prerequisites:
 *   - Generate LAN certs once:  ../../scripts/gen-dev-cert.sh --trust
 *   - Install deps:             npm install
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Config ──────────────────────────────────────────────────────────────────
const SSL_PROXY_PORT = 8443;
const EXPO_PORT = 8081;
const CLIENT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(CLIENT_DIR, '..', 'Cliq.Server');
const CERT_DIR = path.join(SERVER_DIR, 'certs');

// ─── Free occupied dev ports from stale processes ───────────────────────────
function freePort(port) {
  try {
    const pidsRaw = execSync(`lsof -ti tcp:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();

    if (!pidsRaw) return;

    const pids = pidsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (pids.length === 0) return;

    console.log(`⚠️  Port ${port} is in use. Stopping stale process(es): ${pids.join(', ')}`);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        // Ignore races where process exits between lsof and kill.
      }
    }
  } catch {
    // No listener found or lsof unavailable; continue startup.
  }
}

freePort(EXPO_PORT);
freePort(SSL_PROXY_PORT);

// ─── Detect LAN IP (same logic as gen-dev-ip.js) ────────────────────────────
function pickIp() {
  const ifaces = os.networkInterfaces();
  const preferred = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.internal) continue;
      if (iface.family !== 'IPv4') continue;
      if (!/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(iface.address)) continue;
      preferred.push({ name, address: iface.address });
    }
  }
  preferred.sort((a, b) => {
    const score = (x) => (/en\d/.test(x.name) ? 0 : /wi-?fi/i.test(x.name) ? 1 : 5);
    return score(a) - score(b);
  });
  return preferred[0]?.address || null;
}

const ip = pickIp() || 'localhost';

// ─── Find SSL certificates ──────────────────────────────────────────────────
let certFile, keyFile;

if (fs.existsSync(path.join(CERT_DIR, 'dev-lan-cert.crt'))) {
  certFile = path.join(CERT_DIR, 'dev-lan-cert.crt');
  keyFile = path.join(CERT_DIR, 'dev-lan-cert.key');
} else {
  console.error('');
  console.error('❌ SSL certificates not found at:');
  console.error(`   ${CERT_DIR}/dev-lan-cert.crt`);
  console.error('');
  console.error('   Generate them by running (from the repo root):');
  console.error('   ./scripts/gen-dev-cert.sh --trust');
  console.error('');
  process.exit(1);
}

// ─── Generate dev-ip.generated.js (API calls → ASP.NET HTTPS endpoint) ──────
process.env.DEV_API_PROTOCOL = 'https';
process.env.DEV_API_PORT = '7188';
require('./gen-dev-ip');

// ─── Start SSL proxy ────────────────────────────────────────────────────────
console.log('');
console.log(`🔒 SSL proxy: https://${ip}:${SSL_PROXY_PORT} → http://localhost:${EXPO_PORT}`);
console.log(`📁 Using cert: ${certFile}`);
console.log('');

const sslProxy = spawn('npx', [
  'local-ssl-proxy',
  '--source', String(SSL_PROXY_PORT),
  '--target', String(EXPO_PORT),
  '--cert', certFile,
  '--key', keyFile,
  '--hostname', '0.0.0.0'
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: CLIENT_DIR
});

sslProxy.stdout.on('data', (d) => {
  const msg = d.toString().trim();
  if (msg) console.log(`[ssl-proxy] ${msg}`);
});
sslProxy.stderr.on('data', (d) => {
  const msg = d.toString().trim();
  if (msg) console.error(`[ssl-proxy] ${msg}`);
});

// ─── Start Expo ──────────────────────────────────────────────────────────────
const expo = spawn('npx', ['expo', 'start', '--host', 'lan'], {
  stdio: 'inherit',
  cwd: CLIENT_DIR
});

// ─── Cleanup on exit ─────────────────────────────────────────────────────────
function cleanup() {
  console.log('\n🧹 Cleaning up...');
  sslProxy.kill();
  expo.kill();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

sslProxy.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`[ssl-proxy] exited with code ${code}`);
  }
});

expo.on('exit', (code) => {
  sslProxy.kill();
  process.exit(code || 0);
});
