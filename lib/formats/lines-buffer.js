const gtfs = require('gtfs');
const buffer = require('@turf/buffer');

const { simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const lines = await gtfs.getShapesAsGeoJSON(query);
  const geojson = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};
