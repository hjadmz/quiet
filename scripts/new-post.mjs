#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(ROOT, '_posts');
const CONFIG = path.join(ROOT, '_config.yml');

// Jekyll decides a post's date from the filename, in the site's timezone. Read that
// same setting so the file this creates lands on the day the author means. Falling
// back to the machine's own zone is the honest default for a template other people
// use; the previous hardcoded America/Chicago silently misdated posts everywhere else.
function siteTimezone() {
  try {
    const match = fs.readFileSync(CONFIG, 'utf8').match(/^timezone:[ \t]*(?:["']?)([^"'#\n]+)/m);
    const zone = match && match[1].trim();
    if (!zone) return undefined;
    // Reject an unusable zone here rather than crashing on it below.
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

function today(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Keep letters and digits from any script, so a title in Japanese, Greek, Arabic or
// Cyrillic produces a real slug instead of being rejected. Browsers percent-encode
// those paths and Jekyll serves them; refusing them would make the tool usable only
// for people who write in Latin script. Combining marks are folded first, so "café"
// still becomes "cafe" rather than "café".
function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/g, '');
}

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: npm run blog:new -- "Post title"');
  process.exit(2);
}

const slug = slugify(title);
if (!slug) {
  console.error(`"${title}" has no letters or numbers to build a filename from.`);
  process.exit(2);
}

const date = process.env.BLOG_DATE || today(siteTimezone());
const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
const parsedDate = dateMatch
  ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])))
  : null;
const isRealDate = parsedDate
  && parsedDate.getUTCFullYear() === Number(dateMatch[1])
  && parsedDate.getUTCMonth() === Number(dateMatch[2]) - 1
  && parsedDate.getUTCDate() === Number(dateMatch[3]);
if (!isRealDate) {
  console.error('BLOG_DATE must be a real date in YYYY-MM-DD.');
  process.exit(2);
}

fs.mkdirSync(POSTS, { recursive: true });

const year = date.slice(0, 4);
const file = path.join(POSTS, `${date}-${slug}.md`);
if (fs.existsSync(file)) {
  console.error(`Refusing to overwrite ${path.relative(ROOT, file)}`);
  process.exit(1);
}

// The permalink is /:year/:title/, and :title is this slug — so two posts from the
// same year with the same slug resolve to one address no matter how their filenames
// differ. Jekyll builds both without complaint and serves only the last, which is the
// kind of loss you find months later. Catch it while the second post is still a title.
const clash = fs.readdirSync(POSTS)
  .filter((name) => name.endsWith('.md'))
  .find((name) => name.startsWith(`${year}-`) && name.slice(11, -3) === slug);
if (clash) {
  console.error(
    `${path.relative(ROOT, path.join(POSTS, clash))} already claims /${year}/${slug}/.\n` +
    'Two posts from one year cannot share an address — the second would replace the\n' +
    'first silently. Use a different title, or add `permalink: /your/path/` to one.'
  );
  process.exit(1);
}

const source = `---
title: ${JSON.stringify(title)}
description: ""
---

Start writing here.
`;

fs.writeFileSync(file, source, { encoding: 'utf8', flag: 'wx' });

console.log(`Created ${path.relative(ROOT, file)}`);
console.log('Edit the description and body, then preview with npm run dev.');
