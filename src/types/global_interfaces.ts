export interface Config {
  agencies: {
    agencyKey: string;
    agency_key?: string;
    url?: string;
    path?: string;
    exclude?: string[];
  }[];
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
  startDate?: string;
  endDate?: string;
  verbose?: boolean;
  zipOutput?: boolean;
  sqlitePath?: string;
  logFunction?: (text: string) => void;
}
