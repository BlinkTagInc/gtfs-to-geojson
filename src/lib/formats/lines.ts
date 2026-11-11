import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';
import { simplifyGeoJSON } from '../geojson-utils.js';

const lines = (config: Config, input: GeometryInput) => {
  const lines = input.lines();

  if (!lines) {
    return null;
  }

  return simplifyGeoJSON(lines, config);
};

export default lines;
