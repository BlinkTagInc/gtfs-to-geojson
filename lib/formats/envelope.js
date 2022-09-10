import { getShapesAsGeoJSON } from 'gtfs';
import bbox from '@turf/bbox';
import bboxPoly from '@turf/bbox-polygon';
import { featureEach } from '@turf/meta';

import { simplifyGeoJSON } from '../geojson-utils.js';

const envelope = async (config, query = {}) => {
  const lines = await getShapesAsGeoJSON(query);
  const geojson = bboxPoly(bbox(lines));

  featureEach(geojson, (feature) => {
    feature.properties.agency_name = lines.features[0].properties.agency_name;
  });

  return simplifyGeoJSON(geojson, config);
};

export default envelope;
