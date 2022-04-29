import { getShapesAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const linesBuffer = async (config, query = {}) => {
  const lines = await getShapesAsGeoJSON(query);
  const geojson = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default linesBuffer;
