const path = require('path');

const _ = require('lodash');
const archiver = require('archiver');
const fs = require('fs-extra');
const gtfs = require('gtfs');
const sanitize = require('sanitize-filename');

exports.msToSeconds = ms => {
  return Math.round(ms / 1000);
};

exports.getRouteName = route => {
  if (route.route_short_name !== '' && route.route_short_name !== undefined) {
    return route.route_short_name;
  }

  return route.route_long_name;
};

exports.generateLogText = async (agency, outputStats) => {
  const results = gtfs.getFeedInfo({ agency_key: agency.agency_key });
  const feedVersion = results ? results.feed_version : 'Unknown';

  const logText = [
    `Feed Version: ${feedVersion}`,
    `Date Generated: ${new Date()}`,
    ..._.map(outputStats, stat => `${stat.name}: ${stat.value}`)
  ];

  if (agency.url) {
    logText.push(`Source: ${agency.url}`);
  } else if (agency.path) {
    logText.push(`Source: ${agency.path}`);
  }

  return logText;
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

exports.initializeStats = () => {
  return {
    routes: {
      name: 'Routes',
      value: 0
    },
    files: {
      name: 'GeoJSON Files',
      value: 0
    },
    agencies: {
      name: 'Agencies',
      value: 0
    }
  };
};
