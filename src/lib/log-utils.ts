import { clearLine, cursorTo } from 'node:readline';
import * as colors from 'yoctocolors';
import { getFeedInfo } from 'gtfs';
import { noop } from 'lodash-es';
import Table from 'cli-table';

import type { Config } from '../types/global_interfaces.js';

/*
 * Creates text for a log of output details.
 */
export function generateLogText(agency, outputStats, config: Config) {
  const feedInfo = getFeedInfo();
  const feedVersion =
    feedInfo.length > 0 && feedInfo[0].feed_version
      ? feedInfo[0].feed_version
      : 'Unknown';

  const logText = [
    `Feed Version: ${feedVersion}`,
    `GTFS-to-geoJSON Version: ${config.gtfsToGeoJSONVersion}`,
    `Date Generated: ${new Date()}`,
    `Route Count: ${outputStats.routes}`,
    `Shape Count: ${outputStats.shapes}`,
    `GeoJSON File Count: ${outputStats.files}`,
    `Output Type: ${config.outputType}`,
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
export function log(config: Config) {
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
export function logWarning(config: Config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string) => {
    process.stdout.write(`\n${formatWarning(text)}\n`);
  };
}

/*
 * Returns an error log function based on config settings
 */
export function logError(config: Config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string) => {
    process.stdout.write(`\n${formatError(text)}\n`);
  };
}

/*
 * Format console warning text
 */
export function formatWarning(text: string) {
  const warningMessage = `${colors.underline('Warning')}: ${text}`;
  return colors.yellow(warningMessage);
}

/*
 * Format console error text
 */
export function formatError(error: string | Error) {
  const messageText = error instanceof Error ? error.message : error;
  const errorMessage = `${colors.underline('Error')}: ${messageText.replace(
    'Error: ',
    '',
  )}`;
  return colors.red(errorMessage);
}

/*
 * Print a table of stats to the console.
 */
export function logStats(config: Config) {
  // Hide stats table from custom log functions
  if (config.logFunction) {
    return noop;
  }

  return (stats) => {
    const table = new Table({
      colWidths: [40, 20],
      head: ['Item', 'Count'],
    });

    table.push(
      ['📝 Output Type', config.outputType],
      ['🔄 Routes', stats.routes],
      ['⎭ Shapes', stats.shapes],
      ['📄 GeoJSON Files', stats.files],
    );

    log(config)(table.toString());
  };
}

/*
 * Create progress bar text string
 */
const generateProgressBarString = (barTotal, barProgress, size = 40) => {
  const line = '-';
  const slider = '=';
  if (!barTotal) {
    throw new Error('Total value is either not provided or invalid');
  }

  if (!barProgress && barProgress !== 0) {
    throw new Error('Current value is either not provided or invalid');
  }

  if (isNaN(barTotal)) {
    throw new Error('Total value is not an integer');
  }

  if (isNaN(barProgress)) {
    throw new Error('Current value is not an integer');
  }

  if (isNaN(size)) {
    throw new Error('Size is not an integer');
  }

  if (barProgress > barTotal) {
    return slider.repeat(size + 2);
  }

  const percentage = barProgress / barTotal;
  const progress = Math.round(size * percentage);
  const emptyProgress = size - progress;
  const progressText = slider.repeat(progress);
  const emptyProgressText = line.repeat(emptyProgress);
  return progressText + emptyProgressText;
};

/*
 * Print a progress bar to the console.
 */
export function progressBar(formatString: string, barTotal: number, config) {
  let barProgress = 0;

  if (config.verbose === false) {
    return {
      increment: noop,
      interrupt: noop,
    };
  }

  if (barTotal === 0) {
    return {
      interrupt(text: string) {},
      increment() {},
    };
  }

  const renderProgressString = () =>
    formatString
      .replace('{value}', barProgress)
      .replace('{total}', barTotal)
      .replace('{bar}', generateProgressBarString(barTotal, barProgress));

  log(config)(renderProgressString(), true);

  return {
    interrupt(text: string) {
      // Log two lines to avoid overwrite by progress bar
      logWarning(config)(text);
      log(config)('');
    },
    increment() {
      barProgress += 1;
      log(config)(renderProgressString(), true);
    },
  };
}
