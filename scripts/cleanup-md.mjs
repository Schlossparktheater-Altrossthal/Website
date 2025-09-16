#!/usr/bin/env node
import fs from 'node:fs';

// Usage: node scripts/cleanup-md.mjs docs/entwurf-und-analyse.md

const file = process.argv[2];
if (!file) {
  console.error('Usage: cleanup-md.mjs <markdown-file>');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');

// 1) Replace Asciidoctor HTML image spans with Markdown images
src = src.replace(/<span class=\"image\"><img\s+src=\"([^\"]+)\"[^>]*\/>\s*<\/span>/g, '![]($1)');

// 2) Strip heading anchor <a ...></a> inserted before text
src = src.replace(/^(#{1,6})\s*<a[^>]*><\/a>\s*/gm, '$1 ');

// 3) Remove simple wrapper div lines from Asciidoctor output
src = src.replace(/^<\/div>\s*$/gm, '')
         .replace(/^<div[^>]*>\s*$/gm, '')
         .replace(/^<div[^>]*>\s*$/gm, '');

// 4) Remove empty lines sequences to at most two
src = src.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(file, src, 'utf8');
console.log(`Cleaned ${file}`);

