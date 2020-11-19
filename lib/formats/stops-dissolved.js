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

  const stops = await gtfs.getStopsAsGeoJSON(query);

  const bufferedStops = buffer(stops, config.bufferSizeMeters, { units: 'meters' });

  // Run dissolve twice to handle dissolves missed on the first pass.
  // Need to simplify geojson before dissolving otherwise turf.dissolve can hang.
  const dissolved = dissolve(simplifyGeoJSON(bufferedStops, config));
  const dissolved2 = dissolve(dissolved);

  return stripNonAgencyProperties(dissolved2);
};
