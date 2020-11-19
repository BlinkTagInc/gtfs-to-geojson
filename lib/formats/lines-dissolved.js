const gtfs = require('gtfs');
const buffer = require('@turf/buffer');
const dissolve = require('@turf/dissolve').default;

const { simplifyGeoJSON, stripNonAgencyProperties } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const lines = await gtfs.getShapesAsGeoJSON(query);
  const bufferedLines = buffer(lines, config.bufferSizeMeters, { units: 'meters' });

  // Need to simplify geojson before dissolving otherwise turf.dissolve can hang.
  const dissolved = dissolve(simplifyGeoJSON(bufferedLines, config));

  return stripNonAgencyProperties(dissolved);
};
