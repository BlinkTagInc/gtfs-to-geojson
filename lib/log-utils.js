import { clearLine, cursorTo } from 'node:readline';
import chalk from 'chalk';
import { getFeedInfo } from 'gtfs';
import { noop } from 'lodash-es';
import PrettyError from 'pretty-error';
import Table from 'cli-table';

const pe = new PrettyError();
pe.start();

/*
 * Creates text for a log of output details.
 */
export async function generateLogText(agency, outputStats, config) {
  const feedInfo = await getFeedInfo();
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
}

/*
 * Returns a log function based on config settings
 */
export function log(config) {
  if (config.verbose === false) {
    return noop;
  }

  if (config.logFunction) {
    return config.logFunction;
  }

  return (text, overwrite) => {
    if (overwrite === true && process.stdout.isTTY) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
    } else {
      process.stdout.write('\n');
    }

    process.stdout.write(text);
  };
}

/*
 * Returns an warning log function based on config settings
 */
export function logWarning(config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return text => {
    process.stdout.write(`\n${formatWarning(text)}\n`);
  };
}

/*
 * Returns an error log function based on config settings
 */
export function logError(config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return text => {
    process.stdout.write(`\n${formatError(text)}\n`);
  };
}

/*
 * Format console warning text
 */
export function formatWarning(text) {
  return `${chalk.yellow.underline('Warning')}${chalk.yellow(':')} ${chalk.yellow(text)}`;
}

/*
 * Format console error text
 */
export function formatError(error) {
  const message = error instanceof Error ? error.message : error;
  return `${chalk.red.underline('Error')}${chalk.red(':')} ${chalk.red(message.replace('Error: ', ''))}`;
}

/*
 * Print a table of stats to the console.
 */
export function logStats(stats, config) {
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
}
