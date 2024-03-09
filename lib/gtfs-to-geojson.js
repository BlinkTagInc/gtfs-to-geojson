import { readFileSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';

import { clone, omit, uniqBy } from 'lodash-es';
import { getRoutes, getTrips, openDb, importGtfs } from 'gtfs';
import Timer from 'timer-machine';
import sqlString from 'sqlstring-sqlite';

import { getExportPath, writeSanitizedFile, zipFolder } from './file-utils.js';
import { getRouteName, msToSeconds } from './formatters.js';
import { log, logWarning, generateLogText, logStats } from './log-utils.js';

import envelope from './formats/envelope.js';
import convex from './formats/convex.js';
import linesAndStops from './formats/lines-and-stops.js';
import lines from './formats/lines.js';
import linesBuffer from './formats/lines-buffer.js';
import linesDissolved from './formats/lines-dissolved.js';
import stops from './formats/stops.js';
import stopsBuffer from './formats/stops-buffer.js';
import stopsDissolved from './formats/stops-dissolved.js';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)),
);

const setDefaultConfig = (config) => {
  const defaults = {
    gtfsToGeoJSONVersion: version,
    bufferSizeMeters: 400,
    outputType: 'agency',
    outputFormat: 'lines-and-stops',
    skipImport: false,
    verbose: true,
    zipOutput: false,
  };

  return Object.assign(defaults, config);
};

/*
 * Get calendars for a specified date range
 */
const getCalendarsForDateRange = (config) => {
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

  return db.prepare(`SELECT * FROM calendar ${whereClause}`).all();
};

const getGeoJSONByFormat = (config, query = {}) => {
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

const buildGeoJSON = async (agencyKey, config, outputStats) => {
  const db = openDb(config);

  const calendars = getCalendarsForDateRange(config);

  if (config.outputType === 'shape') {
    const shapes = await db
      .prepare('SELECT DISTINCT shape_id FROM shapes')
      .all();

    if (shapes.length === 0) {
      throw new Error(
        'No shapes found in shapes.txt, unable to create geoJSON with outputType = shape',
      );
    }

    await Promise.all(
      shapes.map(async (shape) => {
        const geojson = getGeoJSONByFormat(config, {
          shape_id: shape.shape_id,
          service_id: calendars.map((calendar) => calendar.service_id),
        });
        outputStats.files += 1;
        outputStats.shapes += 1;
        const fileName = `${shape.shape_id}.geojson`;

        await writeSanitizedFile(
          getExportPath(agencyKey),
          fileName,
          JSON.stringify(geojson),
        );
      }),
    );
  } else if (config.outputType === 'route') {
    const routes = getRoutes({
      service_id: calendars.map((calendar) => calendar.service_id),
    });
    await Promise.all(
      routes.map(async (route) => {
        outputStats.routes += 1;

        const trips = getTrips(
          {
            route_id: route.route_id,
            service_id: calendars.map((calendar) => calendar.service_id),
          },
          ['trip_headsign', 'direction_id'],
        );

        const directions = uniqBy(trips, (trip) => trip.trip_headsign);
        await Promise.all(
          directions.map(async (direction) => {
            const geojson = getGeoJSONByFormat(config, {
              route_id: route.route_id,
              direction_id: direction.direction_id,
              service_id: calendars.map((calendar) => calendar.service_id),
            });
            outputStats.files += 1;
            let fileName = '';

            if (route.agency_id !== undefined) {
              fileName += `${route.agency_id}_`;
            }

            fileName += `${getRouteName(route)}_`;

            if (direction.direction_id !== undefined) {
              fileName += direction.direction_id;
            }

            fileName += '.geojson';

            await writeSanitizedFile(
              getExportPath(agencyKey),
              fileName,
              JSON.stringify(geojson),
            );
          }),
        );
      }),
    );
  } else if (config.outputType === 'agency') {
    const geojson = getGeoJSONByFormat(config, {
      service_id: calendars.map((calendar) => calendar.service_id),
    });
    outputStats.files += 1;
    const fileName = `${agencyKey}.geojson`;
    await writeSanitizedFile(
      getExportPath(agencyKey),
      fileName,
      JSON.stringify(geojson),
    );
  } else {
    throw new Error(
      `Invalid outputType=${config.outputType} supplied in config.json`,
    );
  }
};

const gtfsToGeoJSON = async (initialConfig) => {
  const config = setDefaultConfig(initialConfig);
  config.log = log(config);
  config.logWarning = logWarning(config);

  await openDb(config);

  config.log(
    `Started GeoJSON creation for ${config.agencies.length} agencies.`,
  );

  /* eslint-disable no-await-in-loop */
  for (const agency of config.agencies) {
    const timer = new Timer();
    timer.start();

    const outputStats = {
      routes: 0,
      shapes: 0,
      files: 0,
    };

    const agencyKey = agency.agency_key;
    const exportPath = getExportPath(agencyKey);

    // Exclude files that are not needed for GeoJSON creation
    agency.exclude = [
      'areas',
      'attributions',
      'fare_attributes',
      'fare_leg_rules',
      'fare_products',
      'fare_transfer_rules',
      'levels',
      'route_attributes',
      'pathways',
      'stop_areas',
      ...(agency.exclude ?? []),
    ];

    if (config.skipImport !== true) {
      // Import GTFS
      const agencyConfig = clone(omit(config, 'agencies'));
      agencyConfig.agencies = [agency];

      await importGtfs(agencyConfig);
    }

    await rm(exportPath, { recursive: true, force: true });
    await mkdir(exportPath, { recursive: true });
    config.log(`Starting GeoJSON creation for ${agencyKey}`);

    await buildGeoJSON(agencyKey, config, outputStats);

    // Zip output, if specified
    if (config.zipOutput) {
      await zipFolder(exportPath);
    }

    let geojsonPath = `${process.cwd()}/${exportPath}`;
    if (config.zipOutput) {
      geojsonPath += '/geojson.zip';
    }

    // Generate output log.txt
    const logText = generateLogText(agency, outputStats, config);
    await writeSanitizedFile(exportPath, 'log.txt', logText);

    config.log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

    logStats(outputStats, config);

    timer.stop();
    config.log(
      `GeoJSON generation required ${msToSeconds(timer.time())} seconds`,
    );
  }
  /* eslint-enable no-await-in-loop */
};

export default gtfsToGeoJSON;
