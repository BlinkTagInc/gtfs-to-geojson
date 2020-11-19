const path = require('path');

const archiver = require('archiver');
const fs = require('fs-extra');
const untildify = require('untildify');
const sanitize = require('sanitize-filename');

/*
 * Attempt to parse the specified config JSON file.
 */
exports.getConfig = async argv => {
  try {
    const data = await fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8').catch(error => {
      console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
      throw error;
    });
    const config = JSON.parse(data);

    if (argv.skipImport === true) {
      config.skipImport = argv.skipImport;
    }

    return config;
  } catch (error) {
    console.error(new Error(`Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`));
    throw error;
  }
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

exports.getExportPath = agencyKey => {
  return path.join('geojson', sanitize(agencyKey));
};

exports.writeFile = (filePath, fileName, text) => {
  const cleanedFileName = sanitize(fileName);
  return fs.writeFile(path.join(filePath, cleanedFileName), text);
};
