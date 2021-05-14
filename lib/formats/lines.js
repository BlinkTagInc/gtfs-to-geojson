import { getShapesAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const lines = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const geojson = await getShapesAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default lines;
