'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bundle } = require('./run.cjs');

const ROOT = path.resolve(__dirname, '..');
// Running npm's JS entry point avoids shell quoting and npm.cmd differences on
// Windows. npm supplies this path when invoking test:build-env or verify.
const npmCLI = process.env.npm_execpath;
assert.ok(npmCLI && fs.existsSync(npmCLI), 'Run this check with npm run test:build-env.');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-build-env-'));

const notice = /class="footer-meta config-notice"/;
function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [file] : [];
  });
}

function checkOutput(output, development, label) {
  const report = fs.readFileSync(path.join(output, 'site-check/index.html'), 'utf8');
  const problems = report.match(/<ol class="config-problems">([\s\S]*?)<\/ol>/)?.[1] || '';
  assert.match(problems, /body_font is definitely-not-a-supported-font\./,
    `${label}: fixture must report a real configuration problem`);
  const pages = htmlFiles(output);
  assert.ok(pages.length > 0, `${label}: no HTML pages generated`);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    if (!development) assert.doesNotMatch(html, notice,
      `${label}: ${path.relative(output, file)} exposes the development warning`);
  }
  if (development) assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), notice,
    'development builds must still show the warning, so removing it everywhere cannot pass');
}

try {
  // Use a deliberately invalid body font, independent of the template's sample
  // identity. A clean config would hide the notice in every environment.
  const fixture = path.join(temporary, 'invalid-font.yml');
  fs.writeFileSync(fixture, 'body_font: definitely-not-a-supported-font\n');
  const baseConfig = path.join(ROOT, '_config.yml');
  const overlay = path.join(ROOT, '_config.cloudflare.yml');
  const builds = [['build', [baseConfig, fixture]]];
  // A generated site may intentionally remove the optional Cloudflare overlay.
  if (fs.existsSync(overlay)) builds.push(['build:cloudflare', [baseConfig, overlay, fixture]]);

  for (const [script, config] of builds) {
    for (const inherited of [undefined, 'development']) {
      const env = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
      // CI sets production globally. Remove it explicitly rather than using
      // jekyllBuild(), whose default would mask the original bug again.
      for (const key of Object.keys(env)) {
        if (key.toUpperCase() === 'JEKYLL_ENV') delete env[key];
      }
      if (inherited !== undefined) env.JEKYLL_ENV = inherited;
      const label = `${script} with JEKYLL_ENV ${inherited || 'unset'}`;
      const output = path.join(temporary, `${script.replace(':', '-')}-${inherited || 'unset'}`);
      execFileSync(process.execPath, [npmCLI, 'run', script, '--',
        '--config', config.join(','), '--destination', output], {
        cwd: ROOT, env, stdio: 'pipe', timeout: 60000
      });
      checkOutput(output, false, label);
      assert.equal(fs.existsSync(path.join(output, '_headers')), script === 'build:cloudflare',
        `${label}: the fixture must preserve its host-specific output`);
    }
  }

  const developmentOutput = path.join(temporary, 'development');
  bundle(['exec', 'jekyll', 'build', '--strict_front_matter',
    '--config', [baseConfig, fixture].join(','), '--destination', developmentOutput], {
    cwd: ROOT, env: { JEKYLL_ENV: 'development' }
  });
  checkOutput(developmentOutput, true, 'development');
  process.stdout.write(`PASS build environments: ${builds.length} public build command(s) omit development warnings ` +
    'with an unset or development environment; a real problem remains visible in development and site-check\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
