import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';

import archiver from 'archiver';
import untildify from 'untildify';
import sanitize from 'sanitize-filename';

/*
 * Attempt to parse the specified config JSON file.
 */
export async function getConfig(argv) {
  let data;
  let config;

  try {
    data = await readFile(path.resolve(untildify(argv.configPath)), 'utf8');
  } catch (error) {
    throw new Error(
      `Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`,
    );
  }

  try {
    config = JSON.parse(data);
  } catch (error) {
    throw new Error(
      `Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`,
    );
  }

  if (argv.skipImport === true) {
    config.skipImport = argv.skipImport;
  }

  return config;
}

export function zipFolder(exportPath) {
  const output = createWriteStream(path.join(exportPath, 'geojson.zip'));
  const archive = archiver('zip');

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.glob(`${exportPath}/**/*.{json}`);
    archive.finalize();
  });
}

export function getExportPath(agencyKey) {
  return path.join('geojson', sanitize(agencyKey));
}

export async function checkFileExists(filePath) {
  return !!(await stat(filePath).catch((e) => false));
}
