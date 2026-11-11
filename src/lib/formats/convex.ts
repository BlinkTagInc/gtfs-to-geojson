import type { GeometryInput } from '../feed.js';
import turfConvex from '@turf/convex';
import { featureEach } from '@turf/meta';

import { simplifyGeoJSON } from '../geojson-utils.js';
import { logWarning } from '../log-utils.js';
import type { Config } from '../../types/global_interfaces.js';

const convex = (config: Config, input: GeometryInput) => {
  const stops = input.stops();
  const geojson = turfConvex(stops);

  if (!geojson) {
    const locations = new Set(
      stops.features.map((stop) =>
        stop.geometry.coordinates.slice(0, 2).join(','),
      ),
    ).size;
    const count = stops.features.length;
    logWarning(config)(
      `Unable to calculate convex hull for ${input.scope}. Found ${count} ${count === 1 ? 'stop' : 'stops'} with coordinates at ${locations} distinct ${locations === 1 ? 'location' : 'locations'}. A hull requires at least three non-collinear locations.`,
    );
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
