const gtfs = require('gtfs');
const bbox = require('@turf/bbox').default;
const bboxPoly = require('@turf/bbox-polygon').default;
const { featureEach } = require('@turf/meta');

const { simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const lines = await gtfs.getShapesAsGeoJSON(query);
  const geojson = bboxPoly(bbox(lines));

  featureEach(geojson, feature => {
    feature.properties.agency_name = lines.features[0].properties.agency_name;
  });

  return simplifyGeoJSON(geojson, config);
};
