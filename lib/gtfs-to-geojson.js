const { clone, omit, uniqBy } = require('lodash');
const fs = require('fs-extra');
const gtfs = require('gtfs');
const Timer = require('timer-machine');

const { getExportPath, writeFile, zipFolder } = require('./file-utils');
const { getRouteName, msToSeconds } = require('./formatters');
const logUtils = require('./log-utils');

const envelope = require('./formats/envelope');
const convex = require('./formats/convex');
const linesAndStops = require('./formats/lines-and-stops');
const lines = require('./formats/lines');
const linesBuffer = require('./formats/lines-buffer');
const linesDissolved = require('./formats/lines-dissolved');
const stops = require('./formats/stops');
const stopsBuffer = require('./formats/stops-buffer');
const stopsDissolved = require('./formats/stops-dissolved');

const { version } = require('../package.json');

const setDefaultConfig = config => {
  const defaults = {
    gtfsToGeoJSONVersion: version,
    bufferSizeMeters: 400,
    outputType: 'agency',
    outputFormat: 'lines-and-stops',
    skipImport: false,
    verbose: true,
    zipOutput: false
  };

  return Object.assign(defaults, config);
};

const getGeoJSONByFormat = async (config, routeId, directionId) => {
  if (config.outputFormat === 'envelope') {
    return envelope(config, routeId, directionId);
  }

  if (config.outputFormat === 'convex') {
    return convex(config, routeId, directionId);
  }

  if (config.outputFormat === 'lines-and-stops') {
    return linesAndStops(config, routeId, directionId);
  }

  if (config.outputFormat === 'lines') {
    return lines(config, routeId, directionId);
  }

  if (config.outputFormat === 'lines-buffer') {
    return linesBuffer(config, routeId, directionId);
  }

  if (config.outputFormat === 'lines-dissolved') {
    return linesDissolved(config, routeId, directionId);
  }

  if (config.outputFormat === 'stops') {
    return stops(config, routeId, directionId);
  }

  if (config.outputFormat === 'stops-buffer') {
    return stopsBuffer(config, routeId, directionId);
  }

  if (config.outputFormat === 'stops-dissolved') {
    return stopsDissolved(config, routeId, directionId);
  }

  throw new Error(`Invalid \`outputFormat\`=${config.outputFormat} supplied in config.json`);
};

const buildGeoJSON = async (agencyKey, config, outputStats) => {
  if (config.outputType === 'route') {
    const routes = await gtfs.getRoutes();
    await Promise.all(routes.map(async route => {
      outputStats.routes += 1;

      const trips = await gtfs.getTrips({
        route_id: route.route_id
      }, [
        'trip_headsign',
        'direction_id'
      ]);

      const directions = uniqBy(trips, trip => trip.trip_headsign);
      await Promise.all(directions.map(async direction => {
        const geojson = await getGeoJSONByFormat(config, route.route_id, direction.direction_id);
        outputStats.files += 1;
        const fileName = `${getRouteName(route)}_${direction.direction_id}.geojson`;
        await writeFile(getExportPath(agencyKey), fileName, JSON.stringify(geojson));
      }));
    }));
  } else if (config.outputType === 'agency') {
    const geojson = await getGeoJSONByFormat(config);
    outputStats.files += 1;
    const fileName = `${agencyKey}.geojson`;
    await writeFile(getExportPath(agencyKey), fileName, JSON.stringify(geojson));
  } else {
    throw new Error(`Invalid \`outputType\`=${config.outputType} supplied in config.json`);
  }
};

module.exports = async initialConfig => {
  const config = setDefaultConfig(initialConfig);
  config.log = logUtils.log(config);
  config.logWarning = logUtils.logWarning(config);

  await gtfs.openDb(config);

  await Promise.all(config.agencies.map(async agency => {
    const timer = new Timer();
    timer.start();

    const outputStats = {
      routes: 0,
      files: 0
    };

    const agencyKey = agency.agency_key;
    const exportPath = getExportPath(agencyKey);

    if (config.skipImport !== true) {
      // Import GTFS
      const agencyConfig = clone(omit(config, 'agencies'));
      agencyConfig.agencies = [agency];

      await gtfs.import(config);
    }

    await fs.remove(exportPath);
    await fs.ensureDir(exportPath);
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
    const logText = await logUtils.generateLogText(agency, outputStats, config);
    await writeFile(exportPath, 'log.txt', logText);

    config.log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

    logUtils.logStats(outputStats, config);

    timer.stop();
    config.log(`GeoJSON generation required ${msToSeconds(timer.time())} seconds`);
  }));
};
