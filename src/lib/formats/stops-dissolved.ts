import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';
import buffer from '@turf/buffer';

import { simplifyGeoJSON, unionGeojson } from '../geojson-utils.js';

const stopsDissolved = (config: Config, input: GeometryInput) => {
  const stops = input.stops();
  const bufferedStops = buffer(stops, config.bufferSizeMeters, {
    units: 'meters',
  });

  if (!bufferedStops?.features.length) return null;

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedStops = simplifyGeoJSON(bufferedStops, config);
  const geojson = unionGeojson(simplifiedBufferedStops, config);

  // Assign agency_name
  Object.assign(geojson, {
    properties: {
      ...(geojson.type === 'Feature' ? geojson.properties : {}),
      agency_name: bufferedStops.features[0].properties?.agency_name,
    },
  });

  return simplifyGeoJSON(geojson, config);
};

export default stopsDissolved;
