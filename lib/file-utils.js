import path from 'node:path';
import { existsSync, createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import archiver from 'archiver';
import untildify from 'untildify';
import sanitize from 'sanitize-filename';

/*
 * Attempt to parse any config JSON file and read values from CLI.
 */
export async function getConfig(argv) {
  let config;

  if (argv.configPath) {
    // If a `configPath` is specified, try to read it and throw error if it doesn't exist
    try {
      const data = await readFile(
        path.resolve(untildify(argv.configPath)),
        'utf8'
      ).catch((error) => {
        console.error(
          new Error(
            `Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`
          )
        );
        throw error;
      });
      config = Object.assign(JSON.parse(data), argv);
    } catch (error) {
      console.error(
        new Error(
          `Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`
        )
      );
      throw error;
    }
  } else if (existsSync(path.resolve('./config.json'))) {
    // Else if `config.json` exists, use config values read from it
    try {
      const data = await readFile(path.resolve('./config.json'), 'utf8');
      config = Object.assign(JSON.parse(data), argv);
      console.log('Using configuration from ./config.json');
    } catch (error) {
      console.error(
        new Error(
          'Cannot parse configuration file at `./config.json`. Check to ensure that it is valid JSON.'
        )
      );
      throw error;
    }
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

export function writeSanitizedFile(filePath, fileName, text) {
  const cleanedFileName = sanitize(fileName);
  return writeFile(path.join(filePath, cleanedFileName), text);
}
