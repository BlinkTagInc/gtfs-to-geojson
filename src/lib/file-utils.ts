import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { readFile, stat, mkdir } from 'node:fs/promises';

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

export async function zipFolders(folderPaths: string[], exportPath: string) {
  const zipFileName = 'geojson.zip';
  const zipFilePath = path.join(exportPath, zipFileName);

  // Ensure export directory exists
  await mkdir(exportPath, { recursive: true });

  return new Promise<string>((resolve, reject) => {
    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip');

    // Handle events
    output.on('close', () => resolve(zipFilePath));
    archive.on('error', reject);

    // Pipe archive data to the output file
    archive.pipe(output);

    // Add all JSON files from the provided folders
    for (const folderPath of folderPaths) {
      archive.glob('**/*.{json,geojson}', { cwd: folderPath });
    }

    archive.finalize();
  });
}

export function getExportPath(agencyKey) {
  return path.join('geojson', sanitize(agencyKey));
}

export async function checkFileExists(filePath) {
  return !!(await stat(filePath).catch((e) => false));
}
