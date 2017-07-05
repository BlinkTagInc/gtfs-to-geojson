#!/usr/bin/env node

const resolve = require('path').resolve;

const _ = require('lodash');
const fs = require('fs-extra');
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

let config;
let log;

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

// Read config JSON file and merge confiruration file with command-line arguments
fs.readFile(resolve(argv.configPath), 'utf8')
.then(data => JSON.parse(data))
.then(json => {
  config = _.merge(json, argv);
  log = (config.verbose === false) ? _.noop : console.log;
})
.catch(err => {
  console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
  handleError(err);
})
.then(() => {
  log('Starting gtfs-to-geojson');
  mongoose.Promise = global.Promise;
  mongoose.connect(config.mongoUrl, {useMongoClient: true});

  return gtfsToGeoJSON(config);
})
.then(() => {
  log('Completed gtfs-to-geojson');
  process.exit();
})
.catch(handleError);
