import path from 'node:path';
import { access, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';

import archiver from 'archiver';
import untildify from 'untildify';
import sanitize from 'sanitize-filename';

import { Config } from '../types/global_interfaces.js';

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

/*
 * Zip the specified folders into a single zip file.
 */
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

/*
 * Prepare the outputPath directory for writing geojson files.
 */
export async function prepDirectory(outputPath: string, config: Config) {
  // Check if outputPath exists
  try {
    await access(outputPath);
  } catch (error: any) {
    try {
      await mkdir(outputPath, { recursive: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error(
          `Unable to write to ${outputPath}. Try running this command from a writable directory.`,
        );
      }

      throw error;
    }
  }

  // Check if outputPath is empty
  const files = await readdir(outputPath);
  if (config.overwriteExistingFiles === false && files.length > 0) {
    throw new Error(
      `Output directory ${outputPath} is not empty. Please specify an empty directory.`,
    );
  }

  // Delete all files in outputPath if `overwriteExistingFiles` is true
  if (config.overwriteExistingFiles === true) {
    await rm(path.join(outputPath, '*'), { recursive: true, force: true });
  }
}

/*
 * Get the output path for the GeoJSON files.
 */
export function getOutputPath(agencyKey: string, config: Config) {
  return config.outputPath
    ? untildify(config.outputPath)
    : path.join(process.cwd(), 'geojson', sanitize(agencyKey));
}
