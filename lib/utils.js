const path = require('path');

const archiver = require('archiver');
const fs = require('fs-extra');
const gtfs = require('gtfs');

exports.getRouteName = route => {
  if (route.route_short_name !== '' && route.route_short_name !== undefined) {
    return route.route_short_name;
  }
  return route.route_long_name;
};

exports.generateLogText = (agency, outputStats) => {
  return gtfs.getFeedInfo(agency.agency_key).then(results => {
    const feedVersion = results ? results.feed_version : 'Unknown';

    const logText = [
      `Feed Version: ${feedVersion}`,
      `Date Generated: ${new Date()}`,
      `GeoJSON files generated: ${outputStats.files}`,
      `Route Count: ${outputStats.routes}`
    ];

    if (agency.url) {
      logText.push(`Source: ${agency.url}`);
    } else if (agency.path) {
      logText.push(`Source: ${agency.path}`);
    }

    return logText;
  });
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

  geojson.features.forEach(feature => {
    feature.geometry.coordinates.forEach(coordinate => {
      const multiplier = Math.pow(10, coordinatePrecision);
      coordinate[0] = Math.round(coordinate[0] * multiplier) / multiplier;
      coordinate[1] = Math.round(coordinate[1] * multiplier) / multiplier;
    });
  });

  return geojson;
};

exports.setDefaultConfig = config => {
  const defaults = {
    includeStops: true,
    outputType: 'route',
    verbose: true,
    zipOutput: false
  };

  return Object.assign(defaults, config);
};
