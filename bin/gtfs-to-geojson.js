#!/usr/bin/env node

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
const fileUtils = require('../lib/file-utils');
const logUtils = require('../lib/log-utils');

const handleError = error => {
  const text = error || 'Unknown Error';
  process.stdout.write(`\n${logUtils.formatError(text)}\n`);
  console.error(error);
  process.exit(1);
};

const setupImport = async () => {
  const config = await fileUtils.getConfig(argv);
  await gtfsToGeoJSON(config);
  process.exit();
};

setupImport()
  .catch(handleError);
