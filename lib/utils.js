const path = require('path');

const archiver = require('archiver');
const fs = require('fs-extra');
const sanitize = require('sanitize-filename');
const simplify = require('@turf/simplify');

const { version } = require('../package.json');

exports.msToSeconds = ms => {
  return Math.round(ms / 1000);
};

exports.getRouteName = route => {
  if (route.route_short_name !== '' && route.route_short_name !== undefined) {
    return route.route_short_name;
  }

  return route.route_long_name;
};

exports.zipFolder = exportPath => {
  const output = fs.createWriteStream(path.join(exportPath, 'geojson.zip'));
  const archive = archiver('zip');

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.glob(`${exportPath}/**/*.{json}`);
    archive.finalize();
  });
};

const truncateCoordinate = (coordinate, precision) => {
  return [
    Math.round(coordinate[0] * (10 ** precision)) / (10 ** precision),
    Math.round(coordinate[1] * (10 ** precision)) / (10 ** precision)
  ];
};

const truncateGeoJSONDecimals = (geojson, config) => {
  for (const feature of geojson.features) {
    if (feature.geometry.coordinates) {
      if (feature.geometry.type.toLowerCase() === 'point') {
        feature.geometry.coordinates = truncateCoordinate(feature.geometry.coordinates, config.coordinatePrecision);
      } else if (feature.geometry.type.toLowerCase() === 'linestring') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(coordinate => truncateCoordinate(coordinate, config.coordinatePrecision));
      }
    }
  }

  return geojson;
};

exports.simplifyGeoJSON = (geojson, config) => {
  if (config.coordinatePrecision === undefined) {
    return geojson;
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

exports.setDefaultConfig = config => {
  const defaults = {
    gtfsToGeoJSONVersion: version,
    includeStops: true,
    outputType: 'route',
    skipImport: false,
    verbose: true,
    zipOutput: false
  };

  return Object.assign(defaults, config);
};

exports.getExportPath = agencyKey => {
  return path.join('geojson', sanitize(agencyKey));
};

exports.writeFile = (filePath, fileName, text) => {
  const cleanedFileName = sanitize(fileName);
  return fs.writeFile(path.join(filePath, cleanedFileName), text);
};
