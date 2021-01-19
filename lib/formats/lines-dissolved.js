const gtfs = require('gtfs');
const buffer = require('@turf/buffer');
const { geomEach } = require('@turf/meta');
const { multiPolygon } = require('@turf/helpers');
const polygonClipping = require('polygon-clipping');

const { simplifyGeoJSON } = require('../geojson-utils');

module.exports = async (config, routeId, directionId) => {
  const query = {};

  if (routeId !== undefined && directionId !== undefined) {
    query.route_id = routeId;
    query.direction_id = directionId;
  }

  const lines = await gtfs.getShapesAsGeoJSON(query);
  const bufferedLines = buffer(lines, config.bufferSizeMeters, { units: 'meters' });
  const geometries = [];

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedLines = simplifyGeoJSON(bufferedLines, config);

  geomEach(simplifiedBufferedLines, geometry => {
    if (geometry.type === 'MultiPolygon') {
      geometries.push(geometry.coordinates);
    }

    if (geometry.type === 'Polygon') {
      geometries.push([geometry.coordinates]);
    }
  });
  const unioned = polygonClipping.union(...geometries);
  const geojson = multiPolygon(unioned);

  // Assign agency_name
  geojson.properties.agency_name = bufferedLines.features[0].properties.agency_name;

  return simplifyGeoJSON(geojson, config);
};
