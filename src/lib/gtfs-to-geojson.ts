import path from 'node:path';
import { rm, mkdir, writeFile } from 'node:fs/promises';

import { clone, omit, uniqBy } from 'lodash-es';
import { getRoutes, getTrips, openDb, importGtfs } from 'gtfs';
import pLimit from 'p-limit';
import Timer from 'timer-machine';
import sqlString from 'sqlstring-sqlite';
import sanitize from 'sanitize-filename';

import { getExportPath, zipFolders } from './file-utils.js';
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
    skipImport: false,
    verbose: true,
    zipOutput: false,
  };

  return Object.assign(defaults, initialConfig);
};

/*
 * Get a list of service_id for a specified date range
 */
const getServiceIdsForDateRange = (config: Config) => {
  const db = openDb(config);
  let whereClause = '';
  const whereClauses = [];

  if (config.endDate) {
    whereClauses.push(`start_date <= ${sqlString.escape(config.endDate)}`);
  }

  if (config.startDate) {
    whereClauses.push(`end_date >= ${sqlString.escape(config.startDate)}`);
  }

  if (whereClauses.length > 0) {
    whereClause = `WHERE ${whereClauses.join(' AND ')}`;
  }

  const calendars = db.prepare(`SELECT * FROM calendar ${whereClause}`).all();

  return calendars.map(
    (calendar: Record<string, string>) => calendar.service_id,
  );
};

const getGeoJSONByFormat = (config: Config, query = {}) => {
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
  agencyKey: string,
  config: Config,
  outputStats: { files: number; shapes: number; routes: number },
) => {
  const db = openDb(config);
  const baseQuery: { service_id?: string | string[] } = {};

  if (config.startDate || config.endDate) {
    const serviceIds: string[] = getServiceIdsForDateRange(config);
    baseQuery.service_id = serviceIds;
  }

  if (config.outputType === 'shape') {
    const shapes: {
      shape_id: string;
    }[] = await db.prepare('SELECT DISTINCT shape_id FROM shapes').all();

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
          const geojson = getGeoJSONByFormat(config, {
            ...baseQuery,
            shape_id: shape.shape_id,
          });

          if (!geojson) {
            return;
          }

          outputStats.files += 1;
          outputStats.shapes += 1;
          const fileName = `${shape.shape_id}.geojson`;
          const filePath = path.join(
            getExportPath(agencyKey),
            sanitize(fileName),
          );
          await writeFile(filePath, JSON.stringify(geojson));
          bar.increment();
        }),
      ),
    );
  } else if (config.outputType === 'route') {
    const routes = getRoutes(baseQuery);

    const bar = progressBar(
      `${agencyKey}: Generating geoJSON {bar} {value}/{total}`,
      routes.length,
      config,
    );

    await Promise.all(
      routes.map(async (route, index) =>
        limit(async () => {
          outputStats.routes += 1;

          const trips = getTrips(
            {
              ...baseQuery,
              route_id: route.route_id,
            },
            ['trip_headsign', 'direction_id'],
          );

          const directions = uniqBy(trips, (trip) => trip.trip_headsign);
          await Promise.all(
            directions.map(async (direction) => {
              const geojson = getGeoJSONByFormat(config, {
                ...baseQuery,
                route_id: route.route_id,
                direction_id: direction.direction_id,
              });

              if (!geojson) {
                return;
              }

              outputStats.files += 1;
              const fileNameComponents = [];

              if (route.agency_id !== undefined) {
                fileNameComponents.push(route.agency_id);
              }

              fileNameComponents.push(route.route_id);

              if (direction.direction_id !== undefined) {
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

              const filePath = path.join(
                getExportPath(agencyKey),
                sanitize(fileName),
              );
              await writeFile(filePath, JSON.stringify(geojson));
            }),
          );

          bar.increment();
        }),
      ),
    );
  } else if (config.outputType === 'agency') {
    log(config)(`${agencyKey}: Generating geoJSON`);

    const geojson = getGeoJSONByFormat(config, baseQuery);
    outputStats.files += 1;
    const fileName = `${agencyKey}.geojson`;
    const filePath = path.join(getExportPath(agencyKey), sanitize(fileName));
    await writeFile(filePath, JSON.stringify(geojson));
  } else {
    throw new Error(
      `Invalid outputType=${config.outputType} supplied in config.json`,
    );
  }
};

const gtfsToGeoJSON = async (initialConfig: Config) => {
  const config = setDefaultConfig(initialConfig);
  const geojsonPaths = [];

  await openDb(config);

  /* eslint-disable no-await-in-loop */
  for (const agency of config.agencies) {
    const timer = new Timer();
    timer.start();

    const outputStats = {
      routes: 0,
      shapes: 0,
      files: 0,
    };

    const agencyKey = agency.agencyKey ?? agency.agency_key ?? 'unknown';

    const exportPath = getExportPath(agencyKey);

    // Exclude files that are not needed for GeoJSON creation
    agency.exclude = [
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

    if (config.skipImport !== true) {
      // Import GTFS
      const agencyConfig = {
        ...clone(omit(config, 'agencies')),
        agencies: [agency],
      };

      await importGtfs(agencyConfig);
    }

    await rm(exportPath, { recursive: true, force: true });
    await mkdir(exportPath, { recursive: true });

    await buildGeoJSON(agencyKey, config, outputStats);

    const geojsonPath = path.join(process.cwd(), exportPath);

    // Generate output log.txt
    const logText = generateLogText(agency, outputStats, config);
    const filePath = path.join(exportPath, 'log.txt');
    await writeFile(filePath, logText);

    log(config)(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

    logStats(config)(outputStats);

    timer.stop();
    log(config)(
      `GeoJSON generation required ${msToSeconds(timer.time())} seconds`,
    );

    geojsonPaths.push(geojsonPath);
  }
  /* eslint-enable no-await-in-loop */

  // Zip output, if specified in config
  if (config.zipOutput) {
    const zipExportPath = getExportPath(
      config.agencies
        .map((agency) => agency.agencyKey ?? agency.agency_key ?? 'unknown')
        .join('-'),
    );

    await zipFolders(geojsonPaths, zipExportPath);

    const zipFilePath = path.join(process.cwd(), zipExportPath, 'geojson.zip');

    log(config)(`Zipped folder of GeoJSON created at ${zipFilePath}`);

    return zipFilePath;
  }

  return geojsonPaths;
};

export default gtfsToGeoJSON;
