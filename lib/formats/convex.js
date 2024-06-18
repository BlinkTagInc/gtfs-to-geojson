import { getStopsAsGeoJSON } from 'gtfs';
import turfConvex from '@turf/convex';
import { featureEach } from '@turf/meta';

import { simplifyGeoJSON } from '../geojson-utils.js';

const convex = (config, query = {}) => {
  const stops = getStopsAsGeoJSON(query);
  const geojson = turfConvex(stops);

  if (!geojson) {
    if (query.route_id && query.direction_id) {
      config.logWarning(
        `Unable to calculate convex hull for route: ${query.route_id} direction: ${query.direction_id}`,
      );
    } else {
      config.logWarning('Unable to calculate convex hull');
    }
    return null;
  }

  featureEach(geojson, (feature) => {
    // Assign agency_name
    feature.properties = {
      ...(feature.properties || {}),
      agency_name: stops.features[0].properties.agency_name,
    };
  });

  return simplifyGeoJSON(geojson, config);
};

export default convex;
