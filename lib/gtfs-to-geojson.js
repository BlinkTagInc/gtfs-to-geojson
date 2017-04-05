const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const async = require('async');
const gtfs = require('gtfs');
const mkdirp = require('mkdirp-promise');
const rimraf = require('rimraf');
const sanitize = require('sanitize-filename');
const Table = require('cli-table');
const Timer = require('timer-machine');

const utils = require('../lib/utils');

module.exports = (config, cb) => {
  const defaults = {
    zipOutput: false,
    outputType: 'route',
    verbose: true
  };

  Object.assign(defaults, config);

  const log = (config.verbose === false) ? _.noop : console.log;

  function writeFile(filePath, fileName, html) {
    const cleanedFileName = sanitize(fileName);
    log(`  Creating ${cleanedFileName}`);
    return new Promise((resolve, reject) => {
      fs.writeFile(path.join(filePath, cleanedFileName), html, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  async.eachSeries(config.agencies, (agency, cb) => {
    const timer = new Timer();
    const agencyKey = agency.agency_key;
    const exportPath = path.join('geojson', sanitize(agencyKey));
    const fullExportPath = `${process.cwd()}/${exportPath}`;
    const outputStats = {
      routes: 0,
      files: 0
    };

    timer.start();

    log(`Generating geoJSON for ${agencyKey}`);

    return new Promise((resolve, reject) => {
      // Import GTFS
      const agencyConfig = _.clone(_.omit(config, 'agencies'));
      agencyConfig.agencies = [agency];
      gtfs.import(agencyConfig, err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        // Cleanup any previously generated files
        rimraf(exportPath, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    })
    .then(() => mkdirp(exportPath))
    .then(() => gtfs.getRoutesByAgency(agencyKey))
    .then(routes => {
      if (config.outputType === 'direction') {
        return Promise.all(routes.map(route => {
          outputStats.routes += 1;

          return gtfs.getDirectionsByRoute(agencyKey, route.route_id)
          .then(directions => {
            const directionGroups = _.groupBy(directions, direction => direction.direction_id);
            return Promise.all(_.map(directionGroups, directionGroup => {
              const direction = directionGroup[0];
              outputStats.files += 1;
              return gtfs.getShapesByRouteAsGeoJSON(agencyKey, route.route_id, direction.direction_id)
              .then(geojson => utils.simplifyGeoJSON(geojson, config.coordinatePrecision))
              .then(geojson => {
                const fileName = `${utils.getRouteName(route)}_${direction.direction_id}.geojson`;
                return writeFile(exportPath, fileName, JSON.stringify(geojson));
              });
            }));
          });
        }));
      } else if (config.outputType === 'route') {
        return Promise.all(routes.map(route => {
          outputStats.routes += 1;

          return gtfs.getShapesByRouteAsGeoJSON(agencyKey, route.route_id)
          .then(geojson => utils.simplifyGeoJSON(geojson, config.coordinatePrecision))
          .then(geojson => {
            outputStats.files += 1;
            const fileName = `${utils.getRouteName(route)}.geojson`;
            return writeFile(exportPath, fileName, JSON.stringify(geojson));
          });
        }));
      } else if (config.outputType === 'agency') {
        return gtfs.getShapesAsGeoJSON(agencyKey)
        .then(geojson => utils.simplifyGeoJSON(geojson, config.coordinatePrecision))
        .then(geojson => {
          outputStats.files += 1;
          outputStats.routes = routes.length;
          const fileName = `${agencyKey}.geojson`;
          return writeFile(exportPath, fileName, JSON.stringify(geojson));
        });
      }

      throw new Error('Invalid `outputType` supplied in config.json');
    })
    .then(() => utils.generateLogText(agency, outputStats))
    .then(logText => writeFile(exportPath, 'log.txt', logText.join('\n')))
    .then(() => {
      // Zip output, if specified
      if (config.zipOutput) {
        return utils.zipFolder(exportPath);
      }
    })
    .then(() => {
      // Print stats
      let geojsonPath = fullExportPath;
      if (config.zipOutput) {
        geojsonPath += '/geojson.zip';
      }

      log(`GeoJSON for ${agencyKey} created at ${geojsonPath}`);

      timer.stop();

      const table = new Table({
        colWidths: [40, 20],
        head: ['Item', 'Count']
      });

      table.push(
        ['Routes', outputStats.routes],
        ['GeoJSON Files', outputStats.files]
      );

      log(table.toString());
      log(`GeoJSON generation required ${Math.round(timer.time() / 1000)} seconds`);

      cb();
    })
    .catch(cb);
  }, cb);
};
