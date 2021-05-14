import { getShapesAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const linesBuffer = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const lines = await getShapesAsGeoJSON(query);
  const geojson = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default linesBuffer;
