export interface Config {
  agencies: {
    agency_key: string;
    url?: string;
    path?: string;
    exclude?: string[];
  }[];
  bufferSizeMeters?: number;
  coordinatePrecision?: number;
  outputType?: string;
  outputFormat?: string;
  startDate?: string;
  endDate?: string;
  verbose?: boolean;
  zipOutput?: boolean;
  sqlitePath?: string;
  logFunction?: (text: string) => void;
}
