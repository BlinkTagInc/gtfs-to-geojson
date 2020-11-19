const gtfs = require('gtfs');
const convex = require('@turf/convex').default;
const { featureEach } = require('@turf/meta');

const { simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const stops = await gtfs.getStopsAsGeoJSON(query);
  const geojson = convex(stops);

  featureEach(geojson, feature => {
    feature.properties.agency_name = stops.features[0].properties.agency_name;
  });

  return simplifyGeoJSON(geojson, config);
};
