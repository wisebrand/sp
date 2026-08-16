/**
 * =========================================================================
 * ANTIGRAVITY AUTOMATION & RUNTIME ENGINE
 * =========================================================================
 * Script Name: antigravity
 * Core Directives:
 *   1. `sps` is for LOCAL (development, local .env, Express :5000, testing)
 *   2. `sp` is for ONLINE (production deployment, push after every change)
 *   3. Automatically apply changes in `sps` to `sp` strictly EXCLUDING secret files.
 *   4. Automatically commit and push to GitHub remote (`origin main`) after every change.
 *   5. Frictionless execution: Zero confirmation bottlenecks ("no do you want to proceed?").
 * =========================================================================
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const SPS_DIR = path.resolve(__dirname);
const SP_DIR = path.resolve(__dirname, '..', '..', 'sp');

// Secret and temporary files strictly forbidden from being copied or pushed to `sp`
const EXCLUDED_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^\.git$/i,
  /^node_modules$/i,
  /^\.system_generated$/i,
  /^\.tmp$/i,
  /\.log$/i,
  /\.DS_Store$/i,
  /^Thumbs\.db$/i
];

function shouldExclude(fileName) {
  return EXCLUDED_PATTERNS.some(regex => regex.test(fileName));
}

/**
 * Recursively copies non-secret files from source (sps) to destination (sp)
 */
function syncDirectory(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (shouldExclude(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      count += syncDirectory(srcPath, destPath);
    } else {
      let shouldCopy = true;
      if (fs.existsSync(destPath)) {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.mtimeMs <= destStat.mtimeMs && srcStat.size === destStat.size) {
          shouldCopy = false;
        }
      }

      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
  }
  return count;
}

/**
 * Automatically stages, commits, and pushes changes in `sp` (online repo) to GitHub
 */
function pushToOnlineRepo(commitMessage = 'feat: synchronize updates to online deployment') {
  if (!fs.existsSync(path.join(SP_DIR, '.git'))) {
    console.warn('⚠️ [Antigravity]: No git repository found in "sp".');
    return false;
  }

  console.log('\n🚀 [Antigravity]: Staging, committing, and pushing updates to GitHub (sp repo)...');
  try {
    const statusOutput = execSync('git status --porcelain', { cwd: SP_DIR, encoding: 'utf8' }).trim();
    if (!statusOutput) {
      console.log('✨ [Antigravity]: "sp" working directory is already clean. Nothing new to commit.');
    } else {
      execSync('git add .', { cwd: SP_DIR, stdio: 'inherit' });
      execSync(`git commit -m "${commitMessage}"`, { cwd: SP_DIR, stdio: 'inherit' });
      console.log(`✅ [Antigravity]: Committed changes: "${commitMessage}"`);
    }

    try {
      execSync('git push origin main', { cwd: SP_DIR, stdio: 'inherit', timeout: 15000 });
      console.log('🌟 [Antigravity]: Successfully pushed updates to online remote ("origin main")!');
      return true;
    } catch (pushErr) {
      console.log('📌 [Antigravity]: Local commit saved in "sp". To push live, run: cd "C:\\Users\\Young Rolx\\Documents\\GitHub\\sp" && git push origin main');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [Antigravity]: Git operation completed with note:', err.message);
    return false;
  }
}

/**
 * Performs full sync from sps (local) to sp (online) and pushes to GitHub
 */
function performSync(autoPush = true, commitMsg) {
  console.log('\n🔄 [Antigravity]: Syncing updates from sps (local) -> sp (online, excluding secrets)...');
  
  if (!fs.existsSync(SP_DIR)) {
    console.error(`❌ Target online directory "${SP_DIR}" not found.`);
    return false;
  }

  const copied = syncDirectory(SPS_DIR, SP_DIR);
  console.log(`✅ [Antigravity]: Synced ${copied} non-secret file(s) to online "sp" repository.`);

  // Verify that no .env was copied
  const spEnvPath = path.join(SP_DIR, '.env');
  if (fs.existsSync(spEnvPath)) {
    console.warn('⚠️ Found unexpected .env in sp! Removing immediately...');
    fs.unlinkSync(spEnvPath);
  }

  // Run syntax checks
  try {
    execSync('node --check script.js routes/auth.js routes/admin.js utils/jwt.js server.js', { cwd: SP_DIR, stdio: 'pipe' });
    console.log('✅ [Antigravity]: All JavaScript syntax verified in "sp".');
  } catch (err) {
    console.error('❌ [Antigravity]: Syntax check failed in "sp":', err.message);
  }

  if (autoPush) {
    pushToOnlineRepo(commitMsg || `feat: auto-sync updates from sps to sp (${new Date().toLocaleDateString()})`);
  }

  return true;
}

/**
 * Starts Express server with MongoDB
 */
function runServer() {
  console.log('\n🚀 [Antigravity]: Launching Node.js Express server & MongoDB...');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: SPS_DIR,
    stdio: 'inherit',
    shell: true
  });

  serverProcess.on('error', (err) => {
    console.error('❌ Server startup error:', err.message);
  });

  return serverProcess;
}

// CLI Command Dispatcher
const args = process.argv.slice(2);

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║               ANTIGRAVITY AUTOMATION SUITE READY                   ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('📌 Workspace Rule:   sps is for LOCAL, sp is for ONLINE');
console.log('📌 Auto Push:        Pushing to GitHub remote after every change');
console.log('📌 Local Workspace:   sps (Development, Local .env, Express :5000)');
console.log('📌 Online Workspace:  sp  (Production, Cloud Hosting Ready)');
console.log('📌 Admin Account:     mikegborbitey05@gmail.com');
console.log('----------------------------------------------------------------------');

if (args.includes('--dev') || args.includes('-d')) {
  performSync(true);
  runServer();
} else {
  const commitArgIndex = args.findIndex(a => a === '-m' || a === '--message');
  const commitMsg = commitArgIndex !== -1 ? args[commitArgIndex + 1] : undefined;
  performSync(true, commitMsg);
}

module.exports = { performSync, pushToOnlineRepo, runServer, syncDirectory };
