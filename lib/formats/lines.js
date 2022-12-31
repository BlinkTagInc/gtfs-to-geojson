import { getShapesAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const lines = (config, query = {}) => {
  const geojson = getShapesAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default lines;
