import { getStopsAsGeoJSON } from 'gtfs';
import turfConvex from '@turf/convex';
import { featureEach } from '@turf/meta';

import { simplifyGeoJSON } from '../geojson-utils.js';

const convex = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const stops = await getStopsAsGeoJSON(query);
  const geojson = turfConvex(stops);

  featureEach(geojson, feature => {
    feature.properties.agency_name = stops.features[0].properties.agency_name;
  });

  return simplifyGeoJSON(geojson, config);
};

export default convex;
