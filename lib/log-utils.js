const chalk = require('chalk');
const gtfs = require('gtfs');
const { noop } = require('lodash');
const readline = require('readline');
/* eslint-disable-next-line no-unused-vars */
const PrettyError = require('pretty-error').start();
const Table = require('cli-table');

/*
 * Creates text for a log of output details.
 */
exports.generateLogText = async (agency, outputStats, config) => {
  const feedInfo = await gtfs.getFeedInfo();
  const feedVersion = (feedInfo.length > 0 && feedInfo[0].feed_version) ? feedInfo[0].feed_version : 'Unknown';

  const logText = [
    `Feed Version: ${feedVersion}`,
    `GTFS-to-geoJSON Version: ${config.gtfsToGeoJSONVersion}`,
    `Date Generated: ${new Date()}`,
    `Route Count: ${outputStats.routes}`,
    `GeoJSON File Count: ${outputStats.files}`,
    `Output Type: ${config.outputType}`
  ];

  if (agency.url) {
    logText.push(`Source: ${agency.url}`);
  } else if (agency.path) {
    logText.push(`Source: ${agency.path}`);
  }

  return logText.join('\n');
};

/*
 * Returns a log function based on config settings
 */
exports.log = config => {
  if (config.verbose === false) {
    return noop;
  }

  if (config.logFunction) {
    return config.logFunction;
  }

  return (text, overwrite) => {
    if (overwrite === true) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    } else {
      process.stdout.write('\n');
    }

    process.stdout.write(text);
  };
};

/*
 * Returns an warning log function based on config settings
 */
exports.logWarning = config => {
  if (config.logFunction) {
    return config.logFunction;
  }

  return text => {
    process.stdout.write(`\n${exports.formatWarning(text)}\n`);
  };
};

/*
 * Returns an error log function based on config settings
 */
exports.logError = config => {
  if (config.logFunction) {
    return config.logFunction;
  }

  return text => {
    process.stdout.write(`\n${exports.formatError(text)}\n`);
  };
};

/*
 * Format console warning text
 */
exports.formatWarning = text => {
  return `${chalk.yellow.underline('Warning')}${chalk.yellow(':')} ${chalk.yellow(text)}`;
};

/*
 * Format console error text
 */
exports.formatError = error => {
  return `${chalk.red.underline('Error')}${chalk.red(':')} ${chalk.red(error.message.replace('Error: ', ''))}`;
};

/*
 * Print a table of stats to the console.
 */
exports.logStats = (stats, config) => {
  // Hide stats table from custom log functions
  if (config.logFunction) {
    return;
  }

  const table = new Table({
    colWidths: [40, 20],
    head: ['Item', 'Count']
  });

  table.push(
    ['📝 Output Type', config.outputType],
    ['🔄 Routes', stats.routes],
    ['📄 GeoJSON Files', stats.files]
  );

  config.log(table.toString());
};
