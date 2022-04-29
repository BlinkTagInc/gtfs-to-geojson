import { getShapesAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const lines = async (config, query = {}) => {
  const geojson = await getShapesAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default lines;
