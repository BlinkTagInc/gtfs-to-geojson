# GTFS to GeoJSON

[![NPM version](https://img.shields.io/npm/v/gtfs-to-geojson.svg?style=flat)](https://www.npmjs.com/package/gtfs-to-geojson)
[![David](https://img.shields.io/david/blinktaginc/gtfs-to-geojson.svg)]()
[![npm](https://img.shields.io/npm/dm/gtfs-to-geojson.svg?style=flat)]()
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

[![NPM](https://nodei.co/npm/gtfs-to-geojson.png?downloads=true)](https://nodei.co/npm/gtfs-to-geojson/)

`gtfs-to-geojson` converts transit data in [GTFS format](https://developers.google.com/transit/gtfs/) into geoJSON. This includes both shapes and stops.

`gtfs-to-geojson` uses the [`node-gtfs`](https://github.com/blinktaginc/node-gtfs) library to handle importing and querying GTFS data.

## Current Usage
Many transit agencies use `gtfs-to-html` to generate geoJSON used in maps on their websites, including:

* [Marin transit](https://marintransit.org/)

Let us know via opening a github issue or pull request if your agency is using this library.

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs-to-geojson -g

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

## Command-line example

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

## Code example

    const gtfsToGeoJSON = require('gtfs-to-geojson');
    const mongoose = require('mongoose');
    const config = require('config.json');

    mongoose.Promise = global.Promise;
    mongoose.connect(config.mongoUrl);

    gtfsToGeoJSON(config)
    .then(() => {
      console.log('GeoJSON Generation Successful');
    })
    .catch(err => {
      console.error(err);
    });

## Configuration

Copy `config-sample.json` to `config.json` and then add your projects configuration to `config.json`.

    cp config-sample.json config.json

| option | type | description |
| ------ | ---- | ----------- |
| [`agencies`](#agencies) | array | An array of GTFS files to be imported. |
| [`coordinatePrecision`](#coordinatePrecision) | integer | An array of GTFS files to be imported. |
| [`includeStops`](#includeStops) | boolean | Whether or not to include stops in the geoJSON. |
| [`mongoUrl`](#mongoUrl) | string | The URL of the MongoDB database to import to. |
| [`verbose`](#verbose) | boolean | Whether or not to print output to the console. |
| [`outputType`](#outputType) | string | The grouping of the output. Options are "agency" and "route". |
| [`zipOutput`](#zipoutput) | boolean | Whether or not to zip the output into one zip file. |

### agencies

{Array} Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

Each file needs an `agency_key`, a short name you create that is specific to that GTFS file. For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com). You can use the
URL from the agency's website or you can use a URL generated from the transitfeeds.com
API along with your API token.

* Specify a download URL:
```
{
  "agencies": [
    {
      "agency_key": "county-connection",
      "url": "http://cccta.org/GTFS/google_transit.zip"
    }
  ]
}
```

* Specify a path to a zipped GTFS file:
```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/gtfs.zip"
    }
  ]
}
```
* Specify a path to an unzipped GTFS file:
```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

* Exclude files - if you don't want all GTFS files to be imported, you can specify an array of files to exclude.

```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/",
      "exclude": [
        "shapes",
        "stops"
      ]
    }
  ]
}
```

* Optionally specify a proj4 projection string to correct poorly formed coordinates in the GTFS file

```
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/",
      "proj": "+proj=lcc +lat_1=46.8 +lat_0=46.8 +lon_0=0 +k_0=0.99987742 +x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs"
    }
  ]
}
```

### coordinatePrecision

{Integer} The number of decimal places to include in the latitude and longitude of coordinates. Omit to avoid any rounding. `5` is a reasonable value (about 1.1 meters).

```
    "coordinatePrecision": 5
```

### mongoUrl

{String} The MongoDB URI use. When running locally, you may want to use `mongodb://localhost:27017/gtfs`.

```
{
  "mongoUrl": "mongodb://localhost:27017/gtfs",
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

### includeStops

{Boolean} Whether or not to include stops in the geoJSON. Defaults to `true`.

```
    "includeStops": true
```

### verbose

{Boolean} If you don't want the import script to print any output to the console, you can set `verbose` to `false`. Defaults to `true`.

```
    "verbose": false
```

### outputType

{String} The grouping of the output. Choose "agency" to output one geoJSON file with all routes for a single agency. Choose "route" to output one geoJSON file per route and direction. Defaults to `route`.

```
    "outputType": "route"
```

### zipOutput

{Boolean} Whether or not to zip the output into one zip file named `timetables.zip`. Defaults to `false`.

```
    "zipOutput": false
```

## Running

Ensure than mongodb is running locally.

    mongod

To generate geoJSON, run `gtfs-to-geojson`.

    gtfs-to-geojson

By default, `gtfs-to-geojson` will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

This will download the GTFS file specified in `config.js` .  Then, `gtfs-to-geojson` will create geoJSON and save it to `geojson/:agency_key`.

### Options

`configPath`

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

`skipImport`

Skips importing GTFS into MongoDB. Useful if you are rerunning with an unchanged GTFS file. If you use this option and the GTFS file hasn't been imported, you'll get an error.

    gtfs-to-geojson --skipImport


## Processing very large GTFS files.

By default, node has a memory limit of 512 MB or 1 GB. If you have a very large GTFS file, use the `max-old-space-size` option. For example to allocate 2 GB:

    node --max-old-space-size=2000 /usr/local/bin/gtfs-to-geojson

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/gtfs-to-geojson/issues).

### Tests

    npm test
