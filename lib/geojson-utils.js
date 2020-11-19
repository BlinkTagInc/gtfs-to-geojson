const { flatMap } = require('lodash');
const { featureCollection } = require('@turf/helpers');
const { featureEach } = require('@turf/meta');
const simplify = require('@turf/simplify');

const truncateCoordinate = (coordinate, precision) => {
  return [
    Math.round(coordinate[0] * (10 ** precision)) / (10 ** precision),
    Math.round(coordinate[1] * (10 ** precision)) / (10 ** precision)
  ];
};

const truncateGeoJSONDecimals = (geojson, config) => {
  featureEach(geojson, feature => {
    if (feature.geometry.coordinates) {
      if (feature.geometry.type.toLowerCase() === 'point') {
        feature.geometry.coordinates = truncateCoordinate(feature.geometry.coordinates, config.coordinatePrecision);
      } else if (feature.geometry.type.toLowerCase() === 'linestring') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(coordinate => truncateCoordinate(coordinate, config.coordinatePrecision));
      } else if (feature.geometry.type.toLowerCase() === 'polygon') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(line => line.map(coordinate => truncateCoordinate(coordinate, config.coordinatePrecision)));
      } else if (feature.geometry.type.toLowerCase() === 'multipolygon') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(polygon => polygon.map(line => line.map(coordinate => truncateCoordinate(coordinate, config.coordinatePrecision))));
      }
    }
  });

  return geojson;
};

/*
 * Merge any number of geojson objects into one. Only works for `FeatureCollection`.
 */
exports.mergeGeojson = (...geojsons) => featureCollection(flatMap(geojsons, geojson => geojson.features));

/*
 * Simplify geojson and truncate decimals to precision specified in config.
 */
exports.simplifyGeoJSON = (geojson, config) => {
  if (config.coordinatePrecision === undefined) {
    return geojson;
  }

  if (geojson.type.toLowerCase() === 'featurecollection') {
    geojson.features = geojson.features.map(feature => exports.simplifyGeoJSON(feature, config));
    return geojson;
  }

  if (geojson.geometry.type.toLowerCase() === 'multipolygon') {
    return truncateGeoJSONDecimals(geojson, config);
  }

  try {
    const simplifiedGeojson = simplify(geojson, {
      tolerance: 1 / (10 ** config.coordinatePrecision),
      highQuality: true
    });

    return truncateGeoJSONDecimals(simplifiedGeojson, config);
  } catch {
    config.logWarning('Unable to simplify geojson');

    return truncateGeoJSONDecimals(geojson, config);
  }
};

exports.stripNonAgencyProperties = geojson => {
  featureEach(geojson, feature => {
    feature.properties = {
      agency_name: feature.properties.agency_name
    };
  });

  return geojson;
};
