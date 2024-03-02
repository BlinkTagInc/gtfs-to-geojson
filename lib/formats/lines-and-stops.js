import { getStopsAsGeoJSON } from 'gtfs';

import {
  getRouteLinesAsGeoJSON,
  mergeGeojson,
  simplifyGeoJSON,
} from '../geojson-utils.js';

const linesAndStops = (config, query = {}) => {
  const shapesGeojson = getRouteLinesAsGeoJSON(query);
  const stopsGeojson = getStopsAsGeoJSON(query);
  const geojson = mergeGeojson(shapesGeojson, stopsGeojson);

  return simplifyGeoJSON(geojson, config);
};

export default linesAndStops;
