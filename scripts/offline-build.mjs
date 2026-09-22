import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Generate the precache from the actual build, including lazy chunks and ABC files.
export function offlineBuild() {
  let outputDir;
  return {
    name: 'mtunebook-offline',
    apply: 'build',
    configResolved(config) { outputDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(filename) : [filename];
      });
      const files = walk(outputDir).filter((filename) => path.relative(outputDir, filename) !== 'sw.js').sort();
      const workerPath = path.join(outputDir, 'sw.js');
      const template = fs.readFileSync(workerPath, 'utf8');
      const hash = createHash('sha256').update(template);
      const urls = files.map((filename) => {
        const relative = path.relative(outputDir, filename).split(path.sep).join('/');
        hash.update(relative).update(fs.readFileSync(filename));
        return './' + relative.split('/').map(encodeURIComponent).join('/');
      });
      fs.writeFileSync(workerPath, template
        .replace('"__BUILD_VERSION__"', JSON.stringify(hash.digest('hex').slice(0, 16)))
        .replace('["__PRECACHE_FILES__"]', JSON.stringify(urls)), 'utf8');
    }
  };
}
