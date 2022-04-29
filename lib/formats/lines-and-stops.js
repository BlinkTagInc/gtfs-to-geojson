import { getShapesAsGeoJSON, getStopsAsGeoJSON } from 'gtfs';

import { mergeGeojson, simplifyGeoJSON } from '../geojson-utils.js';

const linesAndStops = async (config, query) => {
  const shapesGeojson = await getShapesAsGeoJSON(query);
  const stopsGeojson = await getStopsAsGeoJSON(query);
  const geojson = mergeGeojson(shapesGeojson, stopsGeojson);

  return simplifyGeoJSON(geojson, config);
};

export default linesAndStops;
