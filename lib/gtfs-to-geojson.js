const _ = require('lodash');
const fs = require('fs-extra');
const gtfs = require('gtfs');
const geojsonMerge = require('@mapbox/geojson-merge');
const Promise = require('bluebird');
const Table = require('cli-table');
const Timer = require('timer-machine');

const utils = require('../lib/utils');

const buildGeoJSONByRoute = async (agencyKey, routeId, directionId, config) => {
  const shapesGeojson = await gtfs.getShapesAsGeoJSON({
    agency_key: agencyKey,
    route_id: routeId,
    direction_id: directionId
  });

  if (!config.includeStops) {
    return utils.simplifyGeoJSON(shapesGeojson, config.coordinatePrecision);
  }

  const stopsGeojson = await gtfs.getStopsAsGeoJSON({
    agency_key: agencyKey,
    route_id: routeId,
    direction_id: directionId
  });

  const geojson = await geojsonMerge.merge([shapesGeojson, stopsGeojson]);
  return utils.simplifyGeoJSON(geojson, config.coordinatePrecision);
};

const buildGeoJSONByAgency = async (agencyKey, config) => {
  const shapesGeojson = await gtfs.getShapesAsGeoJSON({agency_key: agencyKey});

  if (!config.includeStops) {
    return utils.simplifyGeoJSON(shapesGeojson, config.coordinatePrecision);
  }

  const stopsGeojson = await gtfs.getStopsAsGeoJSON({agency_key: agencyKey});
  const geojson = await geojsonMerge.merge([shapesGeojson, stopsGeojson]);
  return utils.simplifyGeoJSON(geojson, config.coordinatePrecision);
};

const buildGeoJSON = async (agencyKey, config, stats) => {
  if (!stats) {
    stats = utils.initializeStats();
  }

  if (config.outputType === 'route') {
    const routes = await gtfs.getRoutes({agency_key: agencyKey});
    await Promise.all(routes.map(async route => {
      stats.routes.value += 1;

      const directions = await gtfs.getDirectionsByRoute({
        agency_key: agencyKey,
        route_id: route.route_id
      });
      const directionGroups = _.groupBy(directions, direction => direction.direction_id);
      await Promise.all(_.map(directionGroups, async directionGroup => {
        const direction = directionGroup[0];
        const geojson = await buildGeoJSONByRoute(agencyKey, route.route_id, direction.direction_id, config);
        stats.files.value += 1;
        const fileName = `${utils.getRouteName(route)}_${direction.direction_id}.geojson`;
        await utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
      }));
    }));
  } else if (config.outputType === 'agency') {
    const geojson = await buildGeoJSONByAgency(agencyKey, config);
    stats.files.value += 1;
    const fileName = `${agencyKey}.geojson`;
    await utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
  } else {
    throw new Error('Invalid `outputType` supplied in config.json');
  }
};

module.exports = async selectedConfig => {
  const timer = new Timer();
  const config = utils.setDefaultConfig(selectedConfig);
  const log = (config.verbose === false) ? _.noop : console.log;
  const stats = utils.initializeStats();

  timer.start();

  await Promise.each(config.agencies, async agency => {
    const agencyKey = agency.agency_key;
    const exportPath = utils.getExportPath(agencyKey);

    stats.agencies.value += 1;

    if (config.skipImport !== true) {
      // Import GTFS
      const agencyConfig = _.clone(_.omit(config, 'agencies'));
      agencyConfig.agencies = [agency];

      await gtfs.import(agencyConfig);
    }

    await fs.remove(exportPath);
    await fs.ensureDir(exportPath);
    log(`Starting GeoJSON creation for ${agencyKey}`);

    await buildGeoJSON(agencyKey, config, stats);

    // Zip output, if specified
    if (config.zipOutput) {
      await utils.zipFolder(exportPath);
    }

    let geojsonPath = `${process.cwd()}/${exportPath}`;
    if (config.zipOutput) {
      geojsonPath += '/geojson.zip';
    }

    log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);
  });

  const logText = await utils.generateLogText(stats);

  // Write log to each agency export folder
  await Promise.all(config.agencies.map(agency => {
    return utils.writeFile(utils.getExportPath(agency.agency_key), 'log.txt', logText.join('\n'));
  }));

  timer.stop();

  // Print stats
  const table = new Table({
    colWidths: [40, 20],
    head: ['Item', 'Count']
  });

  table.push(..._.map(stats, stat => [stat.name, stat.value]));

  log(table.toString());
  log(`GeoJSON generation required ${utils.msToSeconds(timer.time())} seconds`);
};
