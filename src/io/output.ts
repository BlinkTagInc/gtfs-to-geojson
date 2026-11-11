import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  lstat,
  writeFile,
} from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';

export function createComponentEncoder() {
  const assigned = new Map<string, string>();
  return (id: string) => {
    const lower = id.toLowerCase();
    if (!assigned.has(lower)) {
      assigned.set(lower, id);
    }

    if (
      assigned.get(lower) === id &&
      /^[a-z0-9_-]{1,90}$/i.test(id) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id)
    ) {
      return id;
    }
    const prefix = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    return (
      prefix + '~' + createHash('sha256').update(id).digest('hex').slice(0, 20)
    );
  };
}

export async function archiveFiles(directory: string, files: string[]) {
  const archive = new ZipArchive();
  const done = pipeline(
    archive,
    createWriteStream(path.join(directory, 'geojson.zip')),
  );
  archive.on('warning', (error) => archive.destroy(error));
  for (const name of files) {
    archive.file(path.join(directory, name), { name });
  }
  await Promise.all([done, archive.finalize()]);
}

const manifest = 'geojson-manifest.json';
async function checkDestination(directory: string, overwrite: boolean) {
  const stat = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return undefined;
  });
  if (!stat) {
    return false;
  }
  if (!stat.isDirectory()) {
    throw new Error('Expected a dedicated output directory: ' + directory);
  }
  const entries = await readdir(directory);
  if (!entries.length) {
    return true;
  }
  if (!entries.includes(manifest)) {
    throw new Error(
      'Choose an empty output directory. This directory contains files without a GeoJSON export manifest: ' +
        directory,
    );
  }
  if (!overwrite) {
    throw new Error(
      'Output directory is not empty. To replace a previous export, enable export.overwrite.',
    );
  }
  const previous = JSON.parse(
    await readFile(path.join(directory, manifest), 'utf8'),
  );
  if (
    previous.generator !== 'gtfs-to-geojson' ||
    !Array.isArray(previous.files)
  ) {
    throw new Error('Invalid GeoJSON output manifest.');
  }
  const allowed = new Set<string>([manifest, ...previous.files]);
  if (previous.archive) {
    allowed.add('geojson.zip');
  }
  const dirs = new Set<string>();
  for (const file of allowed) {
    for (
      let parent = path.posix.dirname(file);
      parent !== '.' && parent !== '/';
      parent = path.posix.dirname(parent)
    ) {
      dirs.add(parent);
    }
  }
  for (const entry of await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    const relative = path
      .relative(directory, path.join(entry.parentPath, entry.name))
      .split(path.sep)
      .join('/');
    if (
      entry.isDirectory()
        ? dirs.has(relative)
        : entry.isFile() && allowed.has(relative)
    ) {
      continue;
    }
    throw new Error(
      'Output directory contains an unrelated file or directory: ' + relative,
    );
  }
  return true;
}

export async function writeDataset(
  directory: string,
  overwrite: boolean,
  archive: boolean,
  generate: (stage: string) => Promise<string[]>,
) {
  directory = path.resolve(directory);
  const parent = path.dirname(directory);
  if (
    directory === parent ||
    process.cwd() === directory ||
    process.cwd().startsWith(directory + path.sep)
  ) {
    throw new Error('Choose a dedicated output directory.');
  }
  await mkdir(parent, { recursive: true });
  const lock = directory + '.gtfs-to-geojson.lock';
  await mkdir(lock);
  try {
    await checkDestination(directory, overwrite);
    const stage = await mkdtemp(path.join(parent, '.geojson-stage-'));
    try {
      const files = (await generate(stage)).sort();
      if (archive) {
        await archiveFiles(stage, files);
      }
      await writeFile(
        path.join(stage, manifest),
        JSON.stringify(
          { generator: 'gtfs-to-geojson', files, archive },
          null,
          2,
        ) + '\n',
      );
      const existing = await checkDestination(directory, overwrite);
      const backup = directory + '.previous-' + randomUUID();
      if (existing) {
        await rename(directory, backup);
      }
      try {
        await rename(stage, directory);
      } catch (error) {
        if (existing) {
          await rename(backup, directory);
        }
        throw error;
      }
      if (existing) {
        await rm(backup, { recursive: true, force: true });
      }
      return {
        outputDirectory: directory,
        files,
        ...(archive && { archivePath: path.join(directory, 'geojson.zip') }),
      };
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
