const path = require('path');

const archiver = require('archiver');
const fs = require('fs-extra');
const sanitize = require('sanitize-filename');

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

exports.simplifyGeoJSON = (geojson, coordinatePrecision) => {
  if (coordinatePrecision === undefined) {
    return geojson;
  }

  for (const feature of geojson.features) {
    for (const coordinate of feature.geometry.coordinates) {
      const multiplier = 10 ** coordinatePrecision;
      coordinate[0] = Math.round(coordinate[0] * multiplier) / multiplier;
      coordinate[1] = Math.round(coordinate[1] * multiplier) / multiplier;
    }
  }

  return geojson;
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
