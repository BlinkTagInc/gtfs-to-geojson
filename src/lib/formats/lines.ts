import { getRouteLinesAsGeoJSON, simplifyGeoJSON } from '../geojson-utils.js';

const lines = (config, query = {}) => {
  const lines = getRouteLinesAsGeoJSON(query);

  if (!lines) {
    return null;
  }

  return simplifyGeoJSON(lines, config);
};

export default lines;
