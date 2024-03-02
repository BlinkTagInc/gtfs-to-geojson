import buffer from '@turf/buffer';

import {
  getRouteLinesAsGeoJSON,
  simplifyGeoJSON,
  unionGeojson,
} from '../geojson-utils.js';

const linesDissolved = (config, query = {}) => {
  const lines = getRouteLinesAsGeoJSON(query);
  const bufferedLines = buffer(lines, config.bufferSizeMeters, {
    units: 'meters',
  });

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedLines = simplifyGeoJSON(bufferedLines, config);
  const geojson = unionGeojson(simplifiedBufferedLines, config);

  // Assign agency_name
  geojson.properties.agency_name =
    bufferedLines.features[0].properties.agency_name;

  return simplifyGeoJSON(geojson, config);
};

export default linesDissolved;
