import { readFileSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';

import { clone, omit, uniqBy } from 'lodash-es';
import { getDb, getRoutes, getTrips, openDb, importGtfs } from 'gtfs';
import Timer from 'timer-machine';

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
  readFileSync(new URL('../package.json', import.meta.url))
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

const getGeoJSONByFormat = async (config, query) => {
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
    `Invalid \`outputFormat\`=${config.outputFormat} supplied in config.json`
  );
};

const buildGeoJSON = async (agencyKey, config, outputStats) => {
  const db = getDb();
  if (config.outputType === 'shape') {
    const shapes = await db.all('SELECT DISTINCT shape_id FROM shapes');

    await Promise.all(
      shapes.map(async (shape) => {
        const geojson = await getGeoJSONByFormat(config, {
          shape_id: shape.shape_id,
        });
        outputStats.files += 1;
        outputStats.shapes += 1;
        const fileName = `${shape.shape_id}.geojson`;

        await writeSanitizedFile(
          getExportPath(agencyKey),
          fileName,
          JSON.stringify(geojson)
        );
      })
    );
  } else if (config.outputType === 'route') {
    const routes = await getRoutes();
    await Promise.all(
      routes.map(async (route) => {
        outputStats.routes += 1;

        const trips = await getTrips(
          {
            route_id: route.route_id,
          },
          ['trip_headsign', 'direction_id']
        );

        const directions = uniqBy(trips, (trip) => trip.trip_headsign);
        await Promise.all(
          directions.map(async (direction) => {
            const geojson = await getGeoJSONByFormat(config, {
              route_id: route.route_id,
              direction_id: direction.direction_id,
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
              JSON.stringify(geojson)
            );
          })
        );
      })
    );
  } else if (config.outputType === 'agency') {
    const geojson = await getGeoJSONByFormat(config);
    outputStats.files += 1;
    const fileName = `${agencyKey}.geojson`;
    await writeSanitizedFile(
      getExportPath(agencyKey),
      fileName,
      JSON.stringify(geojson)
    );
  } else {
    throw new Error(
      `Invalid \`outputType\`=${config.outputType} supplied in config.json`
    );
  }
};

const gtfsToGeoJSON = async (initialConfig) => {
  const config = setDefaultConfig(initialConfig);
  config.log = log(config);
  config.logWarning = logWarning(config);

  await openDb(config);

  config.log(
    `Started GeoJSON creation for ${config.agencies.length} agencies.`
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
    const logText = await generateLogText(agency, outputStats, config);
    await writeSanitizedFile(exportPath, 'log.txt', logText);

    config.log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

    logStats(outputStats, config);

    timer.stop();
    config.log(
      `GeoJSON generation required ${msToSeconds(timer.time())} seconds`
    );
  }
  /* eslint-enable no-await-in-loop */
};

export default gtfsToGeoJSON;
