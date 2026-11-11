import type {
  GtfsBorrowedNativeSqliteDatabaseConfig,
  GtfsCsvParseOptions,
} from 'gtfs';
export type ConfigAgency = {
  agencyKey?: string;
  agency_key?: string;
  path?: string;
  url?: string;
  exclude?: string[];
  headers?: Record<string, string>;
  fillEmptyAgencyId?: boolean;
  agencyId?: string;
};
export type Config = {
  sqlitePath?: string;
  db?: GtfsBorrowedNativeSqliteDatabaseConfig['client'];
  skipImport?: boolean;
  ignoreDuplicates?: boolean;
  downloadTimeout?: number;
  csvOptions?: Omit<GtfsCsvParseOptions, 'skipEmptyLines' | 'relaxQuotes'> & {
    skip_empty_lines?: boolean;
    relax_quotes?: boolean;
  };
  gtfsToGeoJSONVersion?: string;
  logFunction?: (message: string) => void;

  bufferSizeMeters?: number;
  coordinatePrecision?: number;
  agencies: ConfigAgency[];
  logLevel?: 'info' | 'warning' | 'warn' | 'error' | 'silent' | 'debug';
  outputType?: 'agency' | 'route' | 'shape';
  outputFormat?:
    | 'envelope'
    | 'convex'
    | 'stops'
    | 'stops-buffer'
    | 'stops-dissolved'
    | 'lines'
    | 'lines-buffer'
    | 'lines-dissolved'
    | 'lines-and-stops';
  outputPath?: string;
  overwriteExistingFiles?: boolean;
  startDate?: string;
  endDate?: string;
  verbose?: boolean;
  zipOutput?: boolean;
};
