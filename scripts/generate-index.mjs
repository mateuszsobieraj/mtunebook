#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tunesDir = path.resolve(projectRoot, process.argv[2] || 'public/tunes');
const outputFile = path.resolve(projectRoot, process.argv[3] || 'public/tunes/index.json');

function field(source, name) {
  return source.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))?.[1].trim() || '';
}

function displayKey(key) {
  return key
    .replace(/mix(?:olydian)?$/i, ' mixolydian')
    .replace(/dor(?:ian)?$/i, ' dorian')
    .replace(/min(?:or)?$|m$/i, ' minor');
}

if (!fs.existsSync(tunesDir)) {
  console.error(`Tunes directory not found: ${tunesDir}`);
  process.exit(1);
}

let previous = [];
if (fs.existsSync(outputFile)) {
  try { previous = JSON.parse(fs.readFileSync(outputFile, 'utf8')); } catch { /* regenerate invalid JSON */ }
}
const previousByFile = new Map(previous.map((tune) => [tune.filename, tune]));

const tunes = fs.readdirSync(tunesDir)
  .filter((filename) => filename.toLowerCase().endsWith('.abc'))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  .map((filename) => {
    const source = fs.readFileSync(path.join(tunesDir, filename), 'utf8');
    const old = previousByFile.get(filename) || {};
    const rawTempo = field(source, 'Q');
    return {
      filename,
      title: field(source, 'T') || path.parse(filename).name.replaceAll('-', ' '),
      rhythm: field(source, 'R').toLowerCase(),
      meter: field(source, 'M'),
      key: displayKey(field(source, 'K')),
      tempo: Number(rawTempo.match(/(\d+)\s*$/)?.[1]) || 100,
      tags: old.tags || []
    };
  });

fs.writeFileSync(outputFile, `${JSON.stringify(tunes, null, 2)}\n`, 'utf8');
console.log(`Generated an index for ${tunes.length} tunes: ${outputFile}`);
