import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stops = (config: Config, input: GeometryInput) => {
  const geojson = input.stops();

  return simplifyGeoJSON(geojson, config);
};

export default stops;
