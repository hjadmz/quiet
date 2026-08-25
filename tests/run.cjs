'use strict';

// One place the test harnesses shell out from.
//
// Two things were wrong with doing it four separate times. Every harness pinned
// `bundle _2.6.9_`, so a fork with any other Bundler could not run the suite the README
// tells it to run — and the pin was never needed, because Gemfile.lock already records
// the version and `ruby/setup-ruby` honours it. And execFile without a shell cannot find
// `bundle` on Windows, where it is a .bat: the suite was unrunnable there for a reason
// no error message explained.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const WINDOWS = process.platform === 'win32';

// Set QUIET_BUNDLER to pin a Bundler version (e.g. "2.6.9") when reproducing a
// version-specific problem. Unset — the normal case — lets Bundler resolve itself.
const BUNDLER = (process.env.QUIET_BUNDLER || '').trim();

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: 'pipe',
    ...options,
    shell: WINDOWS,
    env: {
      // Jekyll writes UTF-8 and the Ruby checks read it back. Without this, a machine
      // whose locale is US-ASCII fails on the first non-ASCII byte in the output.
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      ...process.env,
      ...options.env
    }
  });
}

function bundle(args, options = {}) {
  return run('bundle', BUNDLER ? [`_${BUNDLER}_`, ...args] : args, options);
}

function jekyllBuild({ source, destination, config, cwd, env = {} }) {
  const args = ['exec', 'jekyll', 'build', '--strict_front_matter'];
  if (source) args.push('--source', source);
  if (destination) args.push('--destination', destination);
  if (config) args.push('--config', Array.isArray(config) ? config.join(',') : config);
  return bundle(args, { cwd, env: { JEKYLL_ENV: 'production', ...env } });
}

// A link to /About/ resolves on macOS and Windows and 404s on GitHub Pages. Comparing
// against the real directory entries is the only way a case-insensitive filesystem
// tells the truth about what a case-sensitive one will serve.
const fs = require('node:fs');
const listings = new Map();

function existsExactCase(file, stopAt) {
  const root = path.resolve(stopAt);
  let current = path.resolve(file);
  const parts = [];
  while (current !== root) {
    const parent = path.dirname(current);
    if (parent === current) return false;
    parts.unshift(path.basename(current));
    current = parent;
  }
  let directory = root;
  for (let index = 0; index < parts.length; index += 1) {
    if (!listings.has(directory)) {
      try {
        listings.set(directory, new Set(fs.readdirSync(directory)));
      } catch {
        return false;
      }
    }
    if (!listings.get(directory).has(parts[index])) return false;
    directory = path.join(directory, parts[index]);
  }
  return true;
}

module.exports = { run, bundle, jekyllBuild, existsExactCase, WINDOWS };
