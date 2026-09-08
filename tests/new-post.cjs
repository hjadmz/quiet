'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'quiet-new-post-'));
const date = '2026-09-08';

function invoke(source, title) {
  const result = spawnSync(process.execPath, [path.join(source, 'scripts/new-post.mjs'), title], {
    cwd: source,
    env: { ...process.env, BLOG_DATE: date },
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `new-post was terminated: ${result.stderr}`);
  return result;
}

try {
  for (const extension of ['md', 'markdown', 'html']) {
    const source = path.join(temporary, extension);
    const posts = path.join(source, '_posts');
    fs.mkdirSync(path.join(source, 'scripts'), { recursive: true });
    fs.mkdirSync(posts);
    fs.copyFileSync(path.join(ROOT, 'scripts/new-post.mjs'), path.join(source, 'scripts/new-post.mjs'));
    fs.writeFileSync(path.join(source, '_config.yml'), 'timezone: Etc/UTC\n');
    const existing = `2026-08-01-same-title.${extension}`;
    const original = '---\ntitle: Same Title\n---\n\nKeep this existing post.\n';
    fs.writeFileSync(path.join(posts, existing), original);

    const conflict = invoke(source, 'Same Title');
    assert.equal(conflict.status, 1, `${extension}: a duplicate address must be rejected`);
    assert.match(conflict.stderr, /already claims \/2026\/same-title\//,
      `${extension}: explain which address the existing post owns`);
    assert.deepEqual(fs.readdirSync(posts), [existing], `${extension}: rejection must create no post`);
    assert.equal(fs.readFileSync(path.join(posts, existing), 'utf8'), original,
      `${extension}: rejection must preserve the existing post`);

    const unique = invoke(source, 'A Different Title');
    assert.equal(unique.status, 0, `${extension}: a different address must remain usable: ${unique.stderr}`);
    const created = path.join(posts, `${date}-a-different-title.md`);
    assert.ok(fs.existsSync(created), `${extension}: the unique post was not created`);
    const createdSource = fs.readFileSync(created, 'utf8');
    assert.match(createdSource, /title: "A Different Title"/);
    const repeat = invoke(source, 'A Different Title');
    assert.equal(repeat.status, 1, `${extension}: an existing filename must never be overwritten`);
    assert.match(repeat.stderr, /Refusing to overwrite/);
    assert.equal(fs.readFileSync(created, 'utf8'), createdSource);
  }
  process.stdout.write('PASS new post: .md, .markdown and .html address conflicts rejected; distinct posts created and existing files preserved\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
