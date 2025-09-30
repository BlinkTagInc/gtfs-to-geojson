import type {
  Config as NodeGtfsConfig,
  ConfigAgency as NodeGtfsConfigAgency,
} from 'gtfs';

export type ConfigAgency = NodeGtfsConfigAgency & {
  agencyKey?: string;
  agency_key?: string;
};

export type Config = Omit<NodeGtfsConfig, 'agencies'> & {
  agencies: ConfigAgency[];
  bufferSizeMeters?: number;
  coordinatePrecision?: number;
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
