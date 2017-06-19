const _ = require('lodash');
const fs = require('fs-extra');
const gtfs = require('gtfs');
const geojsonMerge = require('@mapbox/geojson-merge');
const Promise = require('bluebird');
const Table = require('cli-table');
const Timer = require('timer-machine');

const utils = require('../lib/utils');

function getShapesByDirection(agencyKey, config, stats) {
  return gtfs.getRoutesByAgency(agencyKey)
  .then(routes => Promise.all(routes.map(route => {
    stats.routes.value += 1;

    return gtfs.getDirectionsByRoute(agencyKey, route.route_id)
    .then(directions => {
      const directionGroups = _.groupBy(directions, direction => direction.direction_id);
      return Promise.all(_.map(directionGroups, directionGroup => {
        const direction = directionGroup[0];
        stats.files.value += 1;
        return gtfs.getShapesByRouteAsGeoJSON(agencyKey, route.route_id, direction.direction_id)
        .then(shapesGeojson => utils.simplifyGeoJSON(shapesGeojson, config.coordinatePrecision))
        .then(shapesGeojson => {
          if (!config.includeStops) {
            return shapesGeojson;
          }

          return gtfs.getStopsByRouteAsGeoJSON(agencyKey, route.route_id, direction.direction_id)
          .then(stopsGeojson => geojsonMerge.merge([shapesGeojson, stopsGeojson]));
        })
        .then(geojson => {
          const fileName = `${utils.getRouteName(route)}_${direction.direction_id}.geojson`;
          return utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
        });
      }));
    });
  })));
}

function getShapesByRoute(agencyKey, config, stats) {
  return gtfs.getRoutesByAgency(agencyKey)
  .then(routes => Promise.all(routes.map(route => {
    stats.routes.value += 1;

    // Get shapes by direction so we can add direction_id to geojson properties
    return gtfs.getDirectionsByRoute(agencyKey, route.route_id)
    .then(directions => {
      const directionGroups = _.groupBy(directions, direction => direction.direction_id);
      return Promise.all(_.map(directionGroups, directionGroup => {
        const direction = directionGroup[0];

        return gtfs.getShapesByRouteAsGeoJSON(agencyKey, route.route_id, direction.direction_id)
        .then(shapesGeojson => utils.simplifyGeoJSON(shapesGeojson, config.coordinatePrecision));
      }));
    })
    .then(shapesGeojsons => geojsonMerge.merge([...shapesGeojsons]))
    .then(shapesGeojson => {
      if (!config.includeStops) {
        return shapesGeojson;
      }

      return gtfs.getStopsByRouteAsGeoJSON(agencyKey, route.route_id)
      .then(stopsGeojson => geojsonMerge.merge([shapesGeojson, stopsGeojson]));
    })
    .then(geojson => {
      stats.files.value += 1;
      const fileName = `${utils.getRouteName(route)}.geojson`;
      return utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
    });
  })));
}

function getShapesByAgency(agencyKey, config, stats) {
  return gtfs.getShapesAsGeoJSON(agencyKey)
  .then(shapesGeojson => utils.simplifyGeoJSON(shapesGeojson, config.coordinatePrecision))
  .then(shapesGeojson => {
    if (!config.includeStops) {
      return shapesGeojson;
    }

    return gtfs.getStopsAsGeoJSON(agencyKey)
    .then(stopsGeojson => geojsonMerge.merge([shapesGeojson, stopsGeojson]));
  })
  .then(geojson => {
    stats.files.value += 1;
    const fileName = `${agencyKey}.geojson`;
    return utils.writeFile(utils.getExportPath(agencyKey), fileName, JSON.stringify(geojson));
  });
}

module.exports = selectedConfig => {
  const timer = new Timer();
  const config = utils.setDefaultConfig(selectedConfig);
  const log = (config.verbose === false) ? _.noop : console.log;

  const stats = {
    routes: {
      name: 'Routes',
      value: 0
    },
    files: {
      name: 'GeoJSON Files',
      value: 0
    },
    agencies: {
      name: 'Agencies',
      value: 0
    }
  };

  timer.start();

  return Promise.each(config.agencies, agency => {
    const agencyKey = agency.agency_key;
    const exportPath = utils.getExportPath(agencyKey);

    stats.agencies.value += 1;

    log(`Generating geoJSON for ${agencyKey}`);

    return new Promise(resolve => {
      if (config.skipImport) {
        return resolve();
      }

      // Import GTFS
      const agencyConfig = _.clone(_.omit(config, 'agencies'));
      agencyConfig.agencies = [agency];

      gtfs.import(agencyConfig)
      .then(resolve);
    })
    .then(() => fs.remove(exportPath))
    .then(() => fs.ensureDir(exportPath))
    .then(() => {
      if (config.outputType === 'direction') {
        return getShapesByDirection(agencyKey, config, stats);
      } else if (config.outputType === 'route') {
        return getShapesByRoute(agencyKey, config, stats);
      } else if (config.outputType === 'agency') {
        return getShapesByAgency(agencyKey, config, stats);
      }

      throw new Error('Invalid `outputType` supplied in config.json');
    })
    .then(() => {
      // Zip output, if specified
      if (config.zipOutput) {
        return utils.zipFolder(exportPath);
      }
    })
    .then(() => {
      let geojsonPath = `${process.cwd()}/${exportPath}`;
      if (config.zipOutput) {
        geojsonPath += '/geojson.zip';
      }

      log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);
    });
  })
  .then(() => utils.generateLogText(stats))
  .then(logText => {
    // Write log to each agency export folder
    return Promise.all(config.agencies.map(agency => {
      return utils.writeFile(utils.getExportPath(agency.agency_key), 'log.txt', logText.join('\n'));
    }));
  })
  .then(() => {
    timer.stop();

    // Print stats
    const table = new Table({
      colWidths: [40, 20],
      head: ['Item', 'Count']
    });

    table.push(..._.map(stats, stat => [stat.name, stat.value]));

    log(table.toString());
    log(`GeoJSON generation required ${utils.msToSeconds(timer.time())} seconds`);
  });
};
