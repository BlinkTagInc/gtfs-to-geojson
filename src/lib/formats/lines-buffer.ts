import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const linesBuffer = (config: Config, input: GeometryInput) => {
  const lines = input.lines();

  if (!lines) {
    return null;
  }

  const geojson = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default linesBuffer;
