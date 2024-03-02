import { getRouteLinesAsGeoJSON, simplifyGeoJSON } from '../geojson-utils.js';

const lines = (config, query = {}) => {
  const geojson = getRouteLinesAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default lines;
