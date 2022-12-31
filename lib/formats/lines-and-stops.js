import { getShapesAsGeoJSON, getStopsAsGeoJSON } from 'gtfs';

import { mergeGeojson, simplifyGeoJSON } from '../geojson-utils.js';

const linesAndStops = (config, query) => {
  const shapesGeojson = getShapesAsGeoJSON(query);
  const stopsGeojson = getStopsAsGeoJSON(query);
  const geojson = mergeGeojson(shapesGeojson, stopsGeojson);

  return simplifyGeoJSON(geojson, config);
};

export default linesAndStops;
