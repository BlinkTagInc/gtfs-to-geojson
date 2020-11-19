const gtfs = require('gtfs');

const { simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const geojson = await gtfs.getStopsAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};
