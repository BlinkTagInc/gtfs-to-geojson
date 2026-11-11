import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stopsBuffer = (config: Config, input: GeometryInput) => {
  const stops = input.stops();

  const geojson = buffer(stops, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default stopsBuffer;
