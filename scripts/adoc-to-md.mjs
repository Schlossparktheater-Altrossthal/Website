#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Usage: node scripts/adoc-to-md.mjs <input.adoc> <output.md>

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const [,, inPath, outPath] = process.argv;
if (!inPath || !outPath) die('Usage: adoc-to-md.mjs <input.adoc> <output.md>');

const Asciidoctor = (await import('asciidoctor')).default();

// Convert adoc -> HTML (safe, no includes, with toc) 
const html = Asciidoctor.convert(fs.readFileSync(inPath, 'utf8'), {
  safe: 'safe',
  attributes: {
    'toc': 'macro',
    'toclevels': '3',
    'sectanchors': true,
    'sectnums': true,
    'source-highlighter': 'rouge'
  },
});

const tmpHtml = path.join(path.dirname(outPath), '.tmp-adoc.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

// HTML -> GFM via pandoc
const r = spawnSync('pandoc', [tmpHtml, '-f', 'html', '-t', 'gfm', '--toc', '--toc-depth=3', '-o', outPath], { stdio: 'inherit' });
if (r.status !== 0) die('pandoc failed');

fs.unlinkSync(tmpHtml);
console.log(`Wrote ${outPath}`);

