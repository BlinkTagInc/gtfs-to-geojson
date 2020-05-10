#!/usr/bin/env node

const { resolve } = require('path');

const _ = require('lodash');
const fs = require('fs-extra');
const mongoose = require('mongoose');
const { argv } = require('yargs')
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
  .default('skipImport', undefined);

const gtfsToGeoJSON = require('../lib/gtfs-to-geojson');
const utils = require('../lib/utils');

function handleError(err) {
  console.error(err || 'Unknown Error');
  process.exit(1);
}

const getConfig = async () => {
  const data = await fs.readFile(resolve(argv.configPath), 'utf8');
  const config = JSON.parse(data);

  if (argv.skipImport === true) {
    config.skipImport = argv.skipImport;
  }

  return utils.setDefaultConfig(config);
};

getConfig()
  .catch(error => {
    console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
    handleError(error);
  })
  .then(async config => {
    const log = (config.verbose === false) ? _.noop : console.log;

    log('Starting gtfs-to-geojson');
    mongoose.Promise = global.Promise;
    mongoose.set('useCreateIndex', true);
    mongoose.connect(config.mongoUrl, { useNewUrlParser: true });

    await gtfsToGeoJSON(config);

    log('Completed gtfs-to-geojson');
    process.exit();
  })
  .catch(handleError);
