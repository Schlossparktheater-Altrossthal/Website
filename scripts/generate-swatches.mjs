#!/usr/bin/env node
/*
  Generate SVG color swatches from a palette definition.

  Usage examples:
  - From JSON file (object or array):
      node scripts/generate-swatches.mjs --json docs/swatches/palette.sample.json --out docs/swatches --size 14 --adoc docs/swatches/generated.adoc

  - From CLI list:
      node scripts/generate-swatches.mjs --out docs/swatches emerald-500=#10B981:#047857 amber-500=#F59E0B:#B45309

  JSON formats supported:
    A) Object map: { "emerald-500": { "fill": "#10B981", "stroke": "#047857" }, ... }
    B) Array: [ { "name": "emerald-500", "fill": "#10B981", "stroke": "#047857" }, ... ]
*/

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { out: 'docs/swatches', size: 14, list: [], json: null, adoc: null };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--size') args.size = parseInt(argv[++i] || '14', 10) || 14;
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--adoc') args.adoc = argv[++i];
    else if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    else rest.push(a);
  }
  args.list = rest;
  return args;
}

function parseListItem(spec) {
  // Format: name=#HEX[:#STROKE]
  const [name, colors] = spec.split('=');
  if (!name || !colors) throw new Error(`Invalid spec '${spec}'. Use name=#HEX[:#STROKE]`);
  const [fill, stroke] = colors.split(':');
  return { name, fill, stroke };
}

function normalizePalette({ json, list }) {
  const entries = [];
  if (json) {
    const content = fs.readFileSync(json, 'utf8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      for (const it of data) entries.push({ name: it.name, fill: it.fill, stroke: it.stroke });
    } else if (typeof data === 'object' && data) {
      for (const [name, v] of Object.entries(data)) entries.push({ name, fill: v.fill, stroke: v.stroke });
    } else {
      throw new Error('Unsupported JSON structure');
    }
  }
  if (list && list.length) {
    for (const spec of list) entries.push(parseListItem(spec));
  }
  // Basic validation
  for (const e of entries) {
    if (!/^#[0-9a-fA-F]{6}$/.test(e.fill || '')) throw new Error(`Invalid fill for ${e.name}: '${e.fill}'`);
    if (e.stroke && !/^#[0-9a-fA-F]{6}$/.test(e.stroke)) throw new Error(`Invalid stroke for ${e.name}: '${e.stroke}'`);
  }
  return entries;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeSvg(filePath, size, fill, stroke) {
  const s = Number(size) || 14;
  const strokeAttr = stroke ? ` stroke=\"${stroke}\"` : '';
  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${s}\" height=\"${s}\"><rect width=\"${s}\" height=\"${s}\" fill=\"${fill}\"${strokeAttr}/></svg>\n`;
  fs.writeFileSync(filePath, svg, 'utf8');
}

function main() {
  try {
    const args = parseArgs(process.argv);
    const palette = normalizePalette(args);
    if (!palette.length) {
      console.error('No colors provided. Use --json <file> or specs like name=#HEX[:#STROKE]');
      process.exit(1);
    }
    ensureDir(args.out);
    const adocLines = [];
    for (const { name, fill, stroke } of palette) {
      const file = path.join(args.out, `${name}.svg`);
      writeSvg(file, args.size, fill, stroke);
      const rel = file.replace(/^\.\/?/, '');
      adocLines.push(`image::${rel}[width=${Math.min(12, args.size)},height=${Math.min(12, args.size)}] ${name} (${fill}${stroke ? `/${stroke}` : ''})`);
    }
    if (args.adoc) {
      fs.writeFileSync(args.adoc, adocLines.join('\n') + '\n', 'utf8');
    }
    console.log(`Generated ${palette.length} swatch(es) in ${args.out}`);
    if (args.adoc) console.log(`AsciiDoc snippet written to ${args.adoc}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();

