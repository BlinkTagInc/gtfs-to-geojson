import type { GeometryInput } from '../feed.js';
import type { Config } from '../../types/global_interfaces.js';

import { mergeGeojson, simplifyGeoJSON } from '../geojson-utils.js';

const linesAndStops = (config: Config, input: GeometryInput) => {
  const shapesGeojson = input.lines();

  if (!shapesGeojson) {
    return null;
  }

  const stopsGeojson = input.stops();
  const geojson = mergeGeojson(shapesGeojson, stopsGeojson);

  return simplifyGeoJSON(geojson, config);
};

export default linesAndStops;
