const path = require('path');

const _ = require('lodash');
const fs = require('fs-extra');
const gtfs = require('gtfs');
const Timer = require('timer-machine');
const simplify = require('@turf/simplify');

const utils = require('../lib/utils');
const logUtils = require('../lib/log-utils');

const mergeGeojson = (...geojsons) => {
  /* eslint-disable unicorn/no-reduce */
  return {
    type: 'FeatureCollection',
    features: geojsons.reduce((memo, geojson) => [...memo, ...geojson.features], [])
  };
  /* eslint-enable unicorn/no-reduce */
};

const fetchGeoJSON = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const shapesGeojson = await gtfs.getShapesAsGeoJSON(query);

  if (!config.includeStops) {
    return shapesGeojson;
  }

  const stopsGeojson = await gtfs.getStopsAsGeoJSON(query);

  return mergeGeojson(shapesGeojson, stopsGeojson);
};

const truncateCoordinate = (coordinate, precision) => {
  return [
    Math.round(coordinate[0] * (10 ** precision)) / (10 ** precision),
    Math.round(coordinate[1] * (10 ** precision)) / (10 ** precision)
  ];
};

const truncateGeoJSONDecimals = (geojson, config) => {
  for (const feature of geojson.features) {
    if (feature.geometry.coordinates) {
      if (feature.geometry.type.toLowerCase() === 'point') {
        feature.geometry.coordinates = truncateCoordinate(feature.geometry.coordinates, config.coordinatePrecision);
      } else if (feature.geometry.type.toLowerCase() === 'linestring') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(coordinate => truncateCoordinate(coordinate, config.coordinatePrecision));
      }
    }
  }

  return geojson;
};

const simplifyGeoJSON = (geojson, config) => {
  try {
    const simplifiedGeojson = simplify(geojson, {
      tolerance: 1 / (10 ** config.coordinatePrecision),
      highQuality: true
    });

    return truncateGeoJSONDecimals(simplifiedGeojson, config);
  } catch {
    config.logWarning('Unable to simplify geojson');

    return truncateGeoJSONDecimals(geojson, config);
  }
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

      const directions = _.uniqBy(trips, trip => trip.trip_headsign);
      await Promise.all(directions.map(async direction => {
        const geojson = simplifyGeoJSON(await fetchGeoJSON(config, route.route_id, direction.direction_id), config);
        outputStats.files += 1;
        const fileName = `${utils.getRouteName(route)}_${direction.direction_id}.geojson`;
        await utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
      }));
    }));
  } else if (config.outputType === 'agency') {
    const geojson = simplifyGeoJSON(await fetchGeoJSON(config), config);
    outputStats.files += 1;
    const fileName = `${agencyKey}.geojson`;
    await utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
  } else {
    throw new Error('Invalid `outputType` supplied in config.json');
  }
};

module.exports = async initialConfig => {
  const config = utils.setDefaultConfig(initialConfig);
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
    const exportPath = utils.getExportPath(agencyKey);

    if (config.skipImport !== true) {
      // Import GTFS
      const agencyConfig = _.clone(_.omit(config, 'agencies'));
      agencyConfig.agencies = [agency];

      await gtfs.import(config);
    }

    await fs.remove(exportPath);
    await fs.ensureDir(exportPath);
    config.log(`Starting GeoJSON creation for ${agencyKey}`);

    await buildGeoJSON(agencyKey, config, outputStats);

    // Zip output, if specified
    if (config.zipOutput) {
      await utils.zipFolder(exportPath);
    }

    let geojsonPath = `${process.cwd()}/${exportPath}`;
    if (config.zipOutput) {
      geojsonPath += '/geojson.zip';
    }

    // Generate output log.txt
    const logText = await logUtils.generateLogText(agency, outputStats, config);
    await fs.writeFile(path.join(exportPath, 'log.txt'), logText);

    config.log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

    logUtils.logStats(outputStats, config);

    timer.stop();
    config.log(`GeoJSON generation required ${utils.msToSeconds(timer.time())} seconds`);
  }));
};
