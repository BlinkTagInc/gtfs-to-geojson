import bbox from '@turf/bbox';
import bboxPoly from '@turf/bbox-polygon';
import { featureEach } from '@turf/meta';

import { getRouteLinesAsGeoJSON, simplifyGeoJSON } from '../geojson-utils.js';

const envelope = (config, query = {}) => {
  const lines = getRouteLinesAsGeoJSON(query);
  const geojson = bboxPoly(bbox(lines));

  featureEach(geojson, (feature) => {
    // Assign agency_name
    feature.properties = {
      ...(feature.properties || {}),
      agency_name: lines.features[0].properties.agency_name,
    };
  });

  return simplifyGeoJSON(geojson, config);
};

export default envelope;
