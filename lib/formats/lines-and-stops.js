const gtfs = require('gtfs');

const { mergeGeojson, simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const shapesGeojson = await gtfs.getShapesAsGeoJSON(query);
  const stopsGeojson = await gtfs.getStopsAsGeoJSON(query);
  const geojson = mergeGeojson(shapesGeojson, stopsGeojson);

  return simplifyGeoJSON(geojson, config);
};
