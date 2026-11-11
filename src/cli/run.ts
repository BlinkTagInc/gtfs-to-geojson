import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createConsoleReporter, type GtfsReportingLevel } from 'gtfs';
import pkg from '../../package.json' with { type: 'json' };
import { exportGeoJSON } from '../export.ts';
import {
  layers,
  type GeoJSONConfig,
  type GroupBy,
  type Layer,
} from '../config.ts';

const help =
  `Usage: gtfs-to-geojson [options]

  -c, --config <file>      Read configuration (default: ./config.json)
      --input <path>       GTFS ZIP or directory
      --url <url>          GTFS download URL
      --database <path>    SQLite database
      --source-id <id>     Source for direct input or database-only export
      --output <path>      Destination directory
      --group-by <group>   source, route, route-direction, shape
      --layer <layer>      Repeat to select several layers
      --service-date <day> Service on YYYYMMDD
      --overwrite          Replace a previous export
      --archive            Also create geojson.zip
  -l, --log-level <level>  silent, error, warn, info
  -h, --help               Show help
  -v, --version            Print version

Layers: ` + layers.join(', ');
export async function run(args: string[]) {
  const { values: v, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      config: { type: 'string', short: 'c' },
      input: { type: 'string' },
      url: { type: 'string' },
      database: { type: 'string' },
      'source-id': { type: 'string' },
      output: { type: 'string' },
      'group-by': { type: 'string' },
      layer: { type: 'string', multiple: true },
      'service-date': { type: 'string' },
      overwrite: { type: 'boolean' },
      archive: { type: 'boolean' },
      'log-level': { type: 'string', short: 'l' },
    },
  });
  if (v.version) {
    console.log(pkg.version);
    return;
  }
  if (v.help) {
    console.log(help);
    return;
  }
  if (
    positionals.length &&
    (positionals.length !== 1 || positionals[0] !== 'export')
  ) {
    throw new Error(
      'Unexpected positional argument. Use --input for a GTFS file or see --help.',
    );
  }
  if (v.input !== undefined && v.url !== undefined) {
    throw new Error('Choose --input or --url.');
  }
  let config: GeoJSONConfig = {};
  try {
    config = JSON.parse(await readFile(v.config ?? 'config.json', 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Expected a JSON configuration object.');
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Invalid JSON in ' + (v.config ?? 'config.json') + ': ' + error.message,
        { cause: error },
      );
    }
    if (
      v.config !== undefined ||
      (error as NodeJS.ErrnoException).code !== 'ENOENT'
    ) {
      throw error;
    }
  }
  const direct = v.input !== undefined || v.url !== undefined;
  if (v.database !== undefined) {
    config.database = {
      path: v.database,
      ...(config.database?.durability && {
        durability: config.database.durability,
      }),
    };
  }
  const output = { ...config.export };
  if (direct) {
    const sourceId = v['source-id'] ?? 'default';
    config.sources = [
      {
        sourceId,
        schedule:
          v.url !== undefined ? { url: v.url } : { path: v.input ?? '' },
      },
    ];
    output.sourceId = sourceId;
  } else if (v['source-id'] !== undefined) {
    output.sourceId = v['source-id'];
  }
  if (v.output !== undefined) {
    output.outputDirectory = v.output;
  }
  if (v['group-by'] !== undefined) {
    output.groupBy = v['group-by'] as GroupBy;
  }
  if (v.layer) {
    output.layers = v.layer as Layer[];
  }
  if (v['service-date'] !== undefined) {
    output.serviceDate = Number(v['service-date']);
  }
  if (v.overwrite) {
    output.overwrite = true;
  }
  if (v.archive) {
    output.archive = true;
  }
  await exportGeoJSON({
    ...config,
    export: output,
    reporting: {
      ...config.reporting,
      reporter: createConsoleReporter(),
      ...(v['log-level'] !== undefined && {
        level: v['log-level'] as GtfsReportingLevel,
      }),
    },
  });
}
