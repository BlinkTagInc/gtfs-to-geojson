#!/usr/bin/env node

const fs = require('fs');
const resolve = require('path').resolve;

const _ = require('lodash');
const mongoose = require('mongoose');
const argv = require('yargs')
    .usage('Usage: $0 --config ./config.json')
    .help()
    .option('c', {
      alias: 'configPath',
      describe: 'Path to config file',
      default: './config.json',
      type: 'string'
    })
    .option('s', {
      alias: 'skipImport',
      describe: 'Don\'t import GTFS file.',
      type: 'boolean'
    })
    .argv;

const gtfsToGeoJSON = require('../');

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

function getConfig(cb) {
  const configPath = resolve(argv.configPath);

  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      cb(err);
    }

    const config = JSON.parse(data);

    // Merge confiruration file with command-line arguments
    cb(null, _.merge(config, argv));
  });
}

// Run gtfs-to-geojson
getConfig((err, config) => {
  if (err) {
    console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
    handleError(err);
  }

  mongoose.Promise = global.Promise;
  mongoose.connect(config.mongoUrl);

  gtfsToGeoJSON(config, err => {
    if (err) {
      handleError(err);
    }

    console.log('Completed generating geoJSON');
    process.exit();
  });
});
