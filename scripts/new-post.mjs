#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(ROOT, '_posts');

function chicagoDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
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
  console.error('The title needs at least one letter or number.');
  process.exit(2);
}

const date = process.env.BLOG_DATE || chicagoDate();
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

const file = path.join(POSTS, `${date}-${slug}.md`);
if (fs.existsSync(file)) {
  console.error(`Refusing to overwrite ${path.relative(ROOT, file)}`);
  process.exit(1);
}

const source = `---
title: ${JSON.stringify(title)}
description: ""
published: false
---

Start writing here.
`;

fs.mkdirSync(POSTS, { recursive: true });
fs.writeFileSync(file, source, { encoding: 'utf8', flag: 'wx' });

console.log(`Created ${path.relative(ROOT, file)}`);
console.log('Edit the description and body, then preview with npm run dev.');
console.log('Before publishing: verify the post, set published: true, and run npm run verify.');
