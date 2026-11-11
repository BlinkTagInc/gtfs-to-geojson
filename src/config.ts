import type { GtfsInstanceOptions } from 'gtfs';

export const layers = [
  'route-lines',
  'shape-lines',
  'stop-points',
  'service-areas',
  'network',
  'route-buffers',
  'stop-buffers',
  'route-coverage',
  'stop-coverage',
  'bounding-box',
  'convex-hull',
] as const;
export type Layer = (typeof layers)[number];
export type GroupBy = 'source' | 'route' | 'route-direction' | 'shape';

export interface GeoJSONExportOptions {
  sourceId?: string;
  outputDirectory?: string;
  overwrite?: boolean;
  groupBy?: GroupBy;
  layers?: readonly Layer[];
  serviceDate?:
    number | { start: number; end?: number } | { start?: number; end: number };
  bufferRadiusMeters?: number;
  coordinateDecimals?: number;
  archive?: boolean;
}

export type GeoJSONConfig = Omit<GtfsInstanceOptions, 'database' | 'export'> & {
  database?: GtfsInstanceOptions['database'];
  export?: GeoJSONExportOptions;
};

export function calendarDay(value: number) {
  const date = String(value);
  const day = Date.parse(
    date.slice(0, 4) +
      '-' +
      date.slice(4, 6) +
      '-' +
      date.slice(6) +
      'T00:00:00Z',
  );
  if (
    !Number.isInteger(value) ||
    date.length !== 8 ||
    !Number.isFinite(day) ||
    new Date(day).toISOString().slice(0, 10).replaceAll('-', '') !== date
  ) {
    throw new Error('Expected a real numeric service date (YYYYMMDD).');
  }
  return day / 86400000;
}

export function resolveExport(options: GeoJSONExportOptions = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('export must be an object.');
  }
  for (const key of Object.keys(options)) {
    if (
      ![
        'sourceId',
        'outputDirectory',
        'overwrite',
        'groupBy',
        'layers',
        'serviceDate',
        'bufferRadiusMeters',
        'coordinateDecimals',
        'archive',
      ].includes(key)
    ) {
      if (key === 'serviceDateRange') {
        throw new Error(
          'Rename export.serviceDateRange to export.serviceDate and keep the same range object.',
        );
      }
      throw new Error('Unknown export option: ' + key);
    }
  }
  const result = {
    outputDirectory: './geojson',
    overwrite: false,
    groupBy: 'source' as GroupBy,
    layers: ['route-lines', 'stop-points'] as readonly Layer[],
    bufferRadiusMeters: 400,
    archive: false,
    ...options,
  };
  if (
    typeof result.outputDirectory !== 'string' ||
    !result.outputDirectory.trim()
  ) {
    throw new Error('Expected export.outputDirectory.');
  }
  if (
    !['source', 'route', 'route-direction', 'shape'].includes(result.groupBy)
  ) {
    throw new Error('Invalid export.groupBy.');
  }
  if (typeof result.layers === 'string') {
    const example = layers.includes(result.layers)
      ? result.layers
      : 'route-lines';
    throw new Error(
      `export.layers must be an array of layer names. Received the string ${JSON.stringify(result.layers)}. Example: "layers": ${JSON.stringify([example])}.`,
    );
  }
  if (
    !Array.isArray(result.layers) ||
    !result.layers.length ||
    result.layers.some((l) => !layers.includes(l)) ||
    new Set(result.layers).size !== result.layers.length
  ) {
    throw new Error('Choose distinct export.layers from ' + layers.join(', '));
  }
  if (
    typeof result.overwrite !== 'boolean' ||
    typeof result.archive !== 'boolean'
  ) {
    throw new Error('overwrite and archive must be booleans.');
  }
  if (
    !Number.isFinite(result.bufferRadiusMeters) ||
    result.bufferRadiusMeters <= 0
  ) {
    throw new Error('Expected a positive bufferRadiusMeters.');
  }
  if (
    result.coordinateDecimals !== undefined &&
    (!Number.isInteger(result.coordinateDecimals) ||
      result.coordinateDecimals < 0 ||
      result.coordinateDecimals > 15)
  ) {
    throw new Error('coordinateDecimals must be an integer from 0 to 15.');
  }
  if (typeof result.serviceDate === 'number') {
    calendarDay(result.serviceDate);
  } else if (result.serviceDate !== undefined) {
    const range = result.serviceDate;
    if (
      !range ||
      typeof range !== 'object' ||
      Array.isArray(range) ||
      Object.keys(range).some((key) => key !== 'start' && key !== 'end') ||
      (range.start === undefined && range.end === undefined)
    ) {
      throw new Error(
        'export.serviceDate must be a numeric YYYYMMDD or a range with start, end, or both.',
      );
    }
    const first =
      range.start === undefined ? -Infinity : calendarDay(range.start);
    const last = range.end === undefined ? Infinity : calendarDay(range.end);
    if (first > last) {
      throw new Error(
        'export.serviceDate.start must be on or before export.serviceDate.end.',
      );
    }
  }
  return result;
}
export type ExportSettings = ReturnType<typeof resolveExport>;
