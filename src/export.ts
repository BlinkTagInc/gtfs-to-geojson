import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { Gtfs } from 'gtfs';
import { resolveExport, type GeoJSONConfig } from './config.ts';
import { readGroups } from './geometry/groups.ts';
import { buildLayer } from './geometry/layers.ts';
import { createComponentEncoder, writeDataset } from './io/output.ts';

export async function exportGeoJSON(config: GeoJSONConfig) {
  const {
    sources: configuredSources,
    database = { path: ':memory:' },
    export: options,
    ...shared
  } = config;
  for (const key of Object.keys(shared)) {
    if (!['reporting', 'extensions', 'realtime'].includes(key)) {
      throw new Error('Unknown configuration option: ' + key);
    }
  }
  const settings = resolveExport(options);
  const sources =
    configuredSources ??
    (config.database ? [{ sourceId: settings.sourceId ?? 'default' }] : []);
  if (!Array.isArray(sources) || !sources.length) {
    throw new Error('Configure at least one Schedule source in sources.');
  }
  const ids = new Set<string>();
  for (const source of sources) {
    const id = source.sourceId ?? 'default';
    if (
      typeof id !== 'string' ||
      !id.trim() ||
      ids.has(id) ||
      (sources.length > 1 && !source.sourceId)
    ) {
      throw new Error(
        'Multiple sources require distinct, explicit sourceId values.',
      );
    }
    ids.add(id);
  }
  if (settings.sourceId !== undefined && !ids.has(settings.sourceId)) {
    throw new Error('Unknown export.sourceId: ' + settings.sourceId);
  }
  return writeDataset(
    settings.outputDirectory,
    settings.overwrite,
    settings.archive,
    async (stage) => {
      const files: string[] = [];
      const sourceName = createComponentEncoder();
      for (const source of sources) {
        const sourceId = source.sourceId ?? 'default';
        if (settings.sourceId !== undefined && sourceId !== settings.sourceId) {
          continue;
        }
        const gtfs = new Gtfs({ ...shared, database, sources: [source] });
        try {
          if (source.schedule) {
            const result = await gtfs.import();
            if (!result.success) {
              throw (
                result.errors[0] ??
                new Error('Schedule import failed for ' + sourceId)
              );
            }
          } else if (!(await gtfs.schedule.agency.all()).length) {
            throw new Error('No imported Schedule data for ' + sourceId);
          }
          const log = (level: 'info' | 'warn', message: string) =>
            gtfs.reporting.log({ level, message });
          const before = files.length;
          const component = createComponentEncoder();
          for await (const group of readGroups(gtfs, sourceId, settings)) {
            const folder = [
              sourceName(sourceId),
              ...(group.ids.length
                ? [settings.groupBy, ...group.ids.map(component)]
                : []),
            ].join('/');
            await mkdir(path.join(stage, folder), { recursive: true });
            for (const layer of settings.layers) {
              const output = buildLayer(
                layer,
                group,
                settings,
                sourceId,
                (message) => log('warn', folder + ': ' + message),
              );
              const name = folder + '/' + layer + '.geojson';
              await writeFile(
                path.join(stage, name),
                JSON.stringify(output) + '\n',
                { flag: 'wx' },
              );
              files.push(name);
            }
          }
          log(
            'info',
            sourceId +
              ': wrote ' +
              (files.length - before) +
              ' GeoJSON files to ' +
              path.resolve(settings.outputDirectory),
          );
        } finally {
          await gtfs.close();
        }
      }
      return files;
    },
  );
}
