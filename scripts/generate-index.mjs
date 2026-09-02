#!/usr/bin/env node

/**
 * generate-index.mjs
 *
 * Generates a song index JSON file from .chordpro files in a directory.
 * It reads ChordPro directives {title: ...} and {artist: ...} from each file.
 * If directives are missing, it falls back to the filename.
 *
 * Usage:
 *   node scripts/generate-index.mjs [songsDir] [outputFile]
 *
 * Examples:
 *   node scripts/generate-index.mjs
 *   node scripts/generate-index.mjs ./public/songs ./public/songs/index.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractDirective(content, name) {
  const match = content.match(new RegExp(`^\\s*\\{${name}\\s*:\\s*(.*?)\\s*\\}\\s*$`, 'im'));
  return match ? match[1].trim() : '';
}

function generateSongIndex(songsDir, outputFile) {
  if (!fs.existsSync(songsDir)) {
    console.error(`Error: Songs directory not found: ${songsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(songsDir)
    .filter((file) => /\.(chordpro|cho|crd)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  console.log(`Found ${files.length} song files (.chordpro/.cho/.crd) in ${songsDir}`);

  const songs = files.map((file) => {
    const filePath = path.join(songsDir, file);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract title from {title: ...} directive
    const title = extractDirective(content, 'title') || path.parse(file).name.replace(/\.(chordpro|cho|crd)$/i, '').replace(/[_-]/g, ' ');

    // Extract artist from {artist: ...} directive
    const artist = extractDirective(content, 'artist');

    // Extract genres from {genres: ...} directive
    const genresValue = extractDirective(content, 'genres');
    const genres = genresValue ? genresValue.split(',').map(g => g.trim()) : [];

    // Extract tags from {tags: ...} directive
    const tagsValue = extractDirective(content, 'tags');
    const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()) : [];

    // Extract speed from {speed: ...} directive
    const speed = extractDirective(content, 'speed').toLowerCase();

    return {
      filename: file,
      title: title,
      artist: artist,
      genres: genres,
      tags: tags,
      speed: speed,
      lastModified: stats.mtime.toISOString()
    };
  });

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(songs, null, 2), 'utf8');
  console.log(`Successfully generated index for ${songs.length} songs at ${outputFile}`);
}

// --- Main Execution ---
const args = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '..');

// Default paths based on project structure (React/Vite keeps assets in public/)
const defaultSongsDir = path.join(projectRoot, 'public', 'songs');
const defaultOutputFile = path.join(projectRoot, 'public', 'songs', 'index.json');

const songsDir = args[0] ? path.resolve(projectRoot, args[0]) : defaultSongsDir;
const outputFile = args[1] ? path.resolve(projectRoot, args[1]) : defaultOutputFile;

generateSongIndex(songsDir, outputFile);
