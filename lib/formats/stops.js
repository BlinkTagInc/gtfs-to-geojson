import { getStopsAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stops = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const geojson = await getStopsAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default stops;
