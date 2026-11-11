import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';
import buffer from '@turf/buffer';

import { simplifyGeoJSON, unionGeojson } from '../geojson-utils.js';

const linesDissolved = (config: Config, input: GeometryInput) => {
  const lines = input.lines();

  if (!lines) {
    return null;
  }

  const bufferedLines = buffer(lines, config.bufferSizeMeters, {
    units: 'meters',
  });

  if (!bufferedLines?.features.length) return null;

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedLines = simplifyGeoJSON(bufferedLines, config);
  const geojson = unionGeojson(simplifiedBufferedLines, config);

  // Assign agency_name
  Object.assign(geojson, {
    properties: {
      ...(geojson.type === 'Feature' ? geojson.properties : {}),
      agency_name: bufferedLines.features[0].properties?.agency_name,
    },
  });

  return simplifyGeoJSON(geojson, config);
};

export default linesDissolved;
