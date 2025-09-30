import buffer from '@turf/buffer';

import { getRouteLinesAsGeoJSON, simplifyGeoJSON } from '../geojson-utils.js';

const linesBuffer = (config, query = {}) => {
  const lines = getRouteLinesAsGeoJSON(query);

  if (!lines) {
    return null;
  }

  const geojson = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default linesBuffer;
