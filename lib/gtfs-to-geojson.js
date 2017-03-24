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
  const log = (config.verbose === false) ? _.noop : console.log;

  async.eachSeries(config.agencies, (agency, cb) => {
    const timer = new Timer();
    const agencyKey = agency.agency_key;
    const exportPath = path.join('geojson', sanitize(agencyKey));
    const fullExportPath = `${process.cwd()}/${exportPath}`;
    const outputStats = {
      routes: 0
    };
    let routes;

    timer.start();

    log(`Generating geoJSON for ${agencyKey}`);

    async.series([
      cb => {
        // Import GTFS
        const agencyConfig = _.clone(_.omit(config, 'agencies'));
        agencyConfig.agencies = [agency];
        gtfs.import(agencyConfig, cb);
      },
      cb => {
        // Cleanup any previously generated files
        rimraf(exportPath, cb);
      },
      cb => {
        // Create directory
        mkdirp(exportPath)
        .then(() => {
          cb();
        })
        .catch(cb);
      },
      cb => {
        // Get timetable pages
        gtfs.getRoutesByAgency(agencyKey)
        .then(results => {
          routes = results;
          cb();
        })
        .catch(cb);
      },
      cb => {
        // Build geoJSON
        return Promise.all(routes.map(route => {
          outputStats.routes += 1;

          return gtfs.getShapesByRouteAsGeoJSON(agencyKey, route.route_id)
          .then(geojson => {
            // Write file
            const filename = `${sanitize(utils.getRouteName(route))}.geojson`;
            log(`  Creating ${filename}`);
            return new Promise((resolve, reject) => {
              fs.writeFile(path.join(exportPath, filename), JSON.stringify(geojson), err => {
                if (err) {
                  return reject(err);
                }
                resolve();
              });
            });
          });
        }))
        .then(() => {
          cb();
        })
        .catch(cb);
      },
      cb => {
        // Create log file
        log(`  Export log for ${agencyKey} created at ${path.join(fullExportPath, 'log.txt')}`);
        utils.generateLogText(agency, outputStats).then(logText => {
          fs.writeFile(path.join(exportPath, 'log.txt'), logText.join('\n'), cb);
        }, cb);
      },
      cb => {
        // Zip output, if specified
        if (config.zipOutput) {
          return utils.zipFolder(exportPath).then(() => {
            cb();
          }, cb);
        }
        cb();
      },
      cb => {
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
          ['Routes', outputStats.routes]
        );

        log(table.toString());
        log(`GeoJSON generation required ${Math.round(timer.time() / 1000)} seconds`);
        cb();
      }
    ], cb);
  }, cb);
};
