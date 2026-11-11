import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { groupBy } from 'lodash-es';
import { Gtfs, type GtfsScheduleSourceConfig } from 'gtfs';
import type { GtfsFileBackedFilename } from 'gtfs/schema';
import { readFeed, type GeometryInput } from './feed.js';
import pLimit from 'p-limit';
import Timer from 'timer-machine';
import sanitize from 'sanitize-filename';
import {
  getOutputPath,
  prepDirectory,
  zipFolders,
  untildify,
} from './file-utils.js';
import { msToSeconds } from './formatters.js';
import { log, generateLogText, logStats, progressBar } from './log-utils.js';

import envelope from './formats/envelope.js';
import convex from './formats/convex.js';
import linesAndStops from './formats/lines-and-stops.js';
import lines from './formats/lines.js';
import linesBuffer from './formats/lines-buffer.js';
import linesDissolved from './formats/lines-dissolved.js';
import stops from './formats/stops.js';
import stopsBuffer from './formats/stops-buffer.js';
import stopsDissolved from './formats/stops-dissolved.js';

import packageJson from '../../package.json' with { type: 'json' };
const { version } = packageJson;

import type { Config } from '../types/global_interfaces.js';

const limit = pLimit(20);

const setDefaultConfig = (initialConfig: Config) => {
  const defaults = {
    gtfsToGeoJSONVersion: version,
    bufferSizeMeters: 400,
    outputType: 'agency',
    outputFormat: 'lines-and-stops',
    overwriteExistingFiles: true,
    skipImport: false,
    logLevel: 'info',
    zipOutput: false,
  } as const;

  return { ...defaults, ...initialConfig };
};

const getGeoJSONByFormat = (config: Config, query: GeometryInput) => {
  if (config.outputFormat === 'envelope') {
    return envelope(config, query);
  }

  if (config.outputFormat === 'convex') {
    return convex(config, query);
  }

  if (config.outputFormat === 'lines-and-stops') {
    return linesAndStops(config, query);
  }

  if (config.outputFormat === 'lines') {
    return lines(config, query);
  }

  if (config.outputFormat === 'lines-buffer') {
    return linesBuffer(config, query);
  }

  if (config.outputFormat === 'lines-dissolved') {
    return linesDissolved(config, query);
  }

  if (config.outputFormat === 'stops') {
    return stops(config, query);
  }

  if (config.outputFormat === 'stops-buffer') {
    return stopsBuffer(config, query);
  }

  if (config.outputFormat === 'stops-dissolved') {
    return stopsDissolved(config, query);
  }

  throw new Error(
    `Invalid outputFormat=${config.outputFormat} supplied in config.json`,
  );
};

const buildGeoJSON = async (
  gtfs: Gtfs,
  agencyKey: string,
  config: Config,
  outputPath: string,
  outputStats: { files: number; shapes: number; routes: number },
) => {
  if (config.outputType === 'agency') {
    log(config)(`${agencyKey}: Generating geoJSON`);
    const save = async (input: GeometryInput) => {
      const geojson = getGeoJSONByFormat(config, input);
      await writeFile(
        path.join(outputPath, sanitize(agencyKey + '.geojson')),
        JSON.stringify(geojson),
      );
      outputStats.files += 1;
    };
    if (!config.startDate && !config.endDate) {
      const needsLines =
        config.outputFormat === 'envelope' ||
        config.outputFormat?.startsWith('lines');
      const lines = needsLines ? await gtfs.geojson.routes() : null;
      if (!needsLines || lines?.features.length) {
        const needsStops =
          config.outputFormat === 'convex' ||
          config.outputFormat?.includes('stops');
        const stops = needsStops ? await gtfs.geojson.stops() : null;
        await save({
          scope: `agency ${agencyKey}`,
          lines: () => lines,
          stops: () => ({
            type: 'FeatureCollection',
            features:
              stops?.features.filter((f) => f.properties.routes.length) ?? [],
          }),
        });
        return;
      }
    }
    const feed = await readFeed(gtfs, config);
    await save({
      scope: `agency ${agencyKey}`,
      lines: () => feed.getLines(feed.trips),
      stops: () => feed.getStops(feed.trips),
    });
    return;
  }
  const feed = await readFeed(gtfs, config);
  const generate = (
    trips: typeof feed.trips,
    detail: string,
    shapeId?: string,
  ) =>
    getGeoJSONByFormat(config, {
      scope: `agency ${agencyKey}, ${detail}`,
      lines: () => feed.getLines(trips, shapeId),
      stops: () => feed.getStops(trips),
    });
  if (config.outputType === 'shape') {
    const tripsByShape = groupBy(feed.trips, 'shape_id');
    const shapes = feed.shapeIds;
    if (shapes.length === 0) {
      throw new Error(
        'No shapes found in shapes.txt, unable to create geoJSON with outputType = shape',
      );
    }

    const bar = progressBar(
      `${agencyKey}: Generating geoJSON {bar} {value}/{total}`,
      shapes.length,
      config,
    );

    await Promise.all(
      shapes.map(async (shape) =>
        limit(async () => {
          const geojson = generate(
            tripsByShape[shape] ?? [],
            `shape_id=${shape}`,
            shape,
          );

          if (!geojson) {
            return;
          }

          outputStats.files += 1;
          outputStats.shapes += 1;
          const fileName = `${shape}.geojson`;
          const filePath = path.join(outputPath, sanitize(fileName));
          await writeFile(filePath, JSON.stringify(geojson));
          bar.increment();
        }),
      ),
    );
  } else if (config.outputType === 'route') {
    const tripsByRoute = groupBy(feed.trips, 'route_id');
    const routes = feed.routes.filter((route) => tripsByRoute[route.route_id]);

    const bar = progressBar(
      `${agencyKey}: Generating geoJSON {bar} {value}/{total}`,
      routes.length,
      config,
    );

    await Promise.all(
      routes.map(async (route, index) =>
        limit(async () => {
          outputStats.routes += 1;

          const directions = Object.values(
            groupBy(tripsByRoute[route.route_id], 'direction_id'),
          );
          await Promise.all(
            directions.map(async (trips) => {
              const direction = trips[0];
              const geojson = generate(
                trips,
                `route_id=${route.route_id}, direction_id=${direction.direction_id ?? '(blank)'}`,
              );

              if (!geojson) {
                return;
              }

              outputStats.files += 1;
              const fileNameComponents = [];

              if (route.agency_id !== null) {
                fileNameComponents.push(route.agency_id);
              }

              fileNameComponents.push(route.route_id);

              if (direction.direction_id !== null) {
                fileNameComponents.push(direction.direction_id);
              }

              // Check if file name will be unique, if not append index to filename
              const identicalRoutes = routes.filter(
                (r) =>
                  r.agency_id === route.agency_id &&
                  r.route_id === route.route_id,
              );
              if (identicalRoutes.length > 1) {
                fileNameComponents.push(index.toString());
              }

              const fileName = `${fileNameComponents.join('_')}.geojson`;

              const filePath = path.join(outputPath, sanitize(fileName));
              await writeFile(filePath, JSON.stringify(geojson));
            }),
          );

          bar.increment();
        }),
      ),
    );
  } else {
    throw new Error(
      `Invalid outputType=${config.outputType} supplied in config.json`,
    );
  }
};

const gtfsToGeoJSON = async (initialConfig: Config) => {
  const config = setDefaultConfig(initialConfig);
  const geojsonPaths = [];
  const agencyKeys = [];

  const sourceIds = new Set<string>();

  for (const agency of config.agencies) {
    const timer = new Timer();
    timer.start();

    const outputStats = {
      routes: 0,
      shapes: 0,
      files: 0,
    };

    // Exclude files that are not needed for GeoJSON creation
    const exclude = [
      'areas',
      'attributions',
      'booking_rules',
      'fare_attributes',
      'fare_leg_rules',
      'fare_media',
      'fare_products',
      'fare_rules',
      'fare_transfer_rules',
      'levels',
      'pathways',
      'stop_areas',
      'timeframes',
      'transfers',
      ...(agency.exclude ?? []),
    ];

    const location = agency.url ?? agency.path;
    const sourceId =
      agency.agencyKey ??
      agency.agency_key ??
      (location && createHash('sha256').update(location).digest('hex'));
    if (!sourceId || sourceIds.has(sourceId))
      throw new Error('Each feed needs a unique agencyKey.');
    sourceIds.add(sourceId);
    if ('prefix' in agency && agency.prefix)
      throw new Error(
        'Remove the v4 ID prefix and use agencyKey to distinguish feeds.',
      );
    if ('ignoreErrors' in config && config.ignoreErrors)
      throw new Error(
        'ignoreErrors is unsupported. Correct the feed and retry the import.',
      );
    if ('proj' in agency)
      throw new Error(
        'Convert projected coordinates to WGS84 before importing with gtfs v5.',
      );
    const gtfs = new Gtfs({
      database: config.db
        ? { client: config.db }
        : { path: untildify(config.sqlitePath ?? ':memory:') },
      extensions: ['gtfs-plus'],
      sources: [{ sourceId }],
    });
    try {
      if (!config.skipImport) {
        const input = agency.url
          ? {
              url: agency.url,
              requestHeaders: agency.headers,
              timeoutMs: config.downloadTimeout,
            }
          : agency.path
            ? { path: untildify(agency.path) }
            : null;
        if (!input) throw new Error('Each agency needs a GTFS path or URL.');
        const { skip_empty_lines, relax_quotes, ...csv } =
          config.csvOptions ?? {};
        const schedule: GtfsScheduleSourceConfig = {
          ...input,
          excludeFiles: [
            ...new Set(
              exclude.map(
                (f) =>
                  (f.includes('.') ? f : f + '.txt') as GtfsFileBackedFilename,
              ),
            ),
          ],
          defaultAgencyId: agency.fillEmptyAgencyId
            ? agency.agencyId
            : undefined,
          import: {
            csv: {
              ...csv,
              skipEmptyLines: skip_empty_lines,
              relaxQuotes: relax_quotes,
            },
            validation: {
              onDuplicateKey: config.ignoreDuplicates ? 'keep-first' : 'reject',
            },
          },
        };
        const result = await gtfs.import({ sources: [{ sourceId, schedule }] });
        if (!result.success)
          throw result.errors[0] ?? new Error('GTFS import failed.');
      }
      const agencies = await gtfs.schedule.agency.all();
      if (config.skipImport && !agencies.length)
        throw new Error('No imported feed for ' + sourceId);
      const agencyKey =
        agency.agencyKey ??
        agency.agency_key ??
        (agencies.map((a) => a.agency_name).join('-') || 'unknown');

      const outputPath = getOutputPath(agencyKey, config);

      await prepDirectory(outputPath, config);

      await buildGeoJSON(gtfs, agencyKey, config, outputPath, outputStats);

      // Generate output log.txt
      const logText = await generateLogText(gtfs, agency, outputStats, config);
      const filePath = path.join(outputPath, 'log.txt');
      await writeFile(filePath, logText);

      log(config)(`GeoJSON for ${agencyKey} created at ${outputPath}`);

      logStats(config)(outputStats);

      timer.stop();
      log(config)(
        `GeoJSON generation required ${msToSeconds(timer.time())} seconds`,
      );

      geojsonPaths.push(outputPath);
      agencyKeys.push(agencyKey);
    } finally {
      await gtfs.close();
    }
  }

  // Zip output, if specified in config
  if (config.zipOutput) {
    const outputPath = getOutputPath(agencyKeys.join('-'), config);

    await zipFolders(geojsonPaths, outputPath);

    const zipFilePath = path.join(outputPath, 'geojson.zip');

    log(config)(`Zipped folder of GeoJSON created at ${zipFilePath}`);

    return zipFilePath;
  }

  return geojsonPaths;
};

export default gtfsToGeoJSON;
