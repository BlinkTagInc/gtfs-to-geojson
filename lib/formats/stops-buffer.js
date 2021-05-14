import { getStopsAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stopsBuffer = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const stops = await getStopsAsGeoJSON(query);

  const geojson = buffer(stops, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default stopsBuffer;
