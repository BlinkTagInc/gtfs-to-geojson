<p align="center">
  ➡️
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#configuration">Configuration</a> 
  ⬅️
  <br /><br />
  <img src="docs/images/gtfs-to-geojson-logo.svg" alt="GTFS-to-GeoJSON" />
  <br /><br />
  <a href="https://www.npmjs.com/package/gtfs-to-geojson" rel="nofollow"><img src="https://img.shields.io/npm/v/gtfs-to-geojson.svg?style=flat" style="max-width: 100%;"></a>
  <a href="https://www.npmjs.com/package/gtfs-to-geojson" rel="nofollow"><img src="https://img.shields.io/npm/dm/gtfs-to-geojson.svg?style=flat" style="max-width: 100%;"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  <br /><br />
  Generate geoJSON of transit route data from a GTFS file.
  <br /><br />
  <a href="https://nodei.co/npm/gtfs-to-geojson/" rel="nofollow"><img src="https://nodei.co/npm/gtfs-to-geojson.png?downloads=true" alt="NPM" style="max-width: 100%;"></a>
</p>

<hr>

`gtfs-to-geojson` converts transit data in [GTFS format](https://developers.google.com/transit/gtfs/) into geoJSON. This includes both shapes and stops. It can be configured to generate one geoJSON file per route or a single file which contains all routes for an agency. This is useful for creating maps of transit routes.

<img width="762" src="https://user-images.githubusercontent.com/96217/81493949-96532f00-9259-11ea-9e09-d0399b59bf30.png">

<img width="762" src="https://user-images.githubusercontent.com/96217/101810511-1da99f00-3ad6-11eb-90e7-cb2b6919a77f.jpg">

`gtfs-to-geojson` uses the [`node-gtfs`](https://github.com/blinktaginc/node-gtfs) library to handle importing and querying GTFS data. If you are looking to generate HTML timetables in addition to maps, check out the [gtfs-to-html](https://github.com/BlinkTagInc/gtfs-to-html) project. If you'd like to make a cool stringline chart of all trips on a route throughout the day, check out the [gtfs-to-chart](https://github.com/BlinkTagInc/gtfs-to-chart) project.

## Current Usage
Many transit agencies use `gtfs-to-geojson` to generate the maps for their websites, including:

* [511 Contra Costa](https://511contracosta.org/public-transit/contra-costa-transit-map/)
* [County Connection](https://countyconnection.com/)
* [Kings Area Rural Transit (KART)](https://www.kartbus.org/)
* [Marin Transit](https://marintransit.org/)
* [MVgo](https://mvgo.org/)

Are you using `gtfs-to-geojson`? Let us know via email (brendan@blinktag.com) or via opening a github issue or pull request if your agency is using this library.

## Installation

If you would like to use this library as a command-line utility, you can install it globally directly from [npm](https://npmjs.org):

    npm install gtfs-to-geojson -g

If you are using this as a node module as part of an application, you can include it in your project's `package.json` file.

## Quick Start

### Command-line example

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

### Code example

```js
import gtfsToGeoJSON from 'gtfs-to-geojson';
import { readFile } from 'fs/promises';
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));

gtfsToGeoJSON(config)
.then(() => {
  console.log('GeoJSON Generation Successful');
})
.catch(err => {
  console.error(err);
});
```

## Configuration

Copy `config-sample.json` to `config.json` and then add your projects configuration to `config.json`.

    cp config-sample.json config.json

A sample configuration that pulls in GTFS for 29 Bay Area transit agencies is at `config-sample-bayarea.json`.  It is used generate data for the map on [bayareatransitmap.com](https://bayareatransitmap.com).

| option | type | description |
| ------ | ---- | ----------- |
| [`agencies`](#agencies) | array | An array of GTFS files to be imported. |
| [`bufferSizeMeters`](#buffersizemeters) | integer | Radius of buffers in meters. Optional, defaults to 400 meters (1/4 mile). |
| [`coordinatePrecision`](#coordinateprecision) | integer | The number of decimal places to include in the latitude and longitude of coordinates and geojson simplification. Optional. |
| [`outputType`](#outputtype) | string | The grouping of the output. Options are "agency" and "route". Optional, defaults to "agency". |
| [`outputFormat`](#outputformat) | string | The format of the output. Options are "envelope", "convex", "stops", "stops-buffer", "stops-dissolved", "lines", "lines-buffer", "lines-dissolved" and "lines-and-stops". Optional, defaults to "lines-and-stops". |
| [`sqlitePath`](#sqlitepath) | string | A path to an SQLite database. Optional, defaults to using an in-memory database. |
| [`verbose`](#verbose) | boolean | Whether or not to print output to the console. Optional, defaults to true. |
| [`zipOutput`](#zipoutput) | boolean | Whether or not to zip the output into one zip file. Optional, defaults to false. |

### agencies

{Array} Specify the GTFS files to be imported in an `agencies` array. GTFS files can be imported via a `url` or a local `path`.

Each file needs an `agency_key`, a short name you create that is specific to that GTFS file. For GTFS files that contain more than one agency, you only need to list each GTFS file once in the `agencies` array, not once per agency that it contains.

To find an agency's GTFS file, visit [transitfeeds.com](http://transitfeeds.com). You can use the
URL from the agency's website or you can use a URL generated from the transitfeeds.com
API along with your API token.

* Specify a download URL:
```json
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
```json
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
```json
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/unzipped/gtfs/"
    }
  ]
}
```

* Specify multiple agencies (each one will be imported and processed separately). See `config-sample-bayarea.json` for a working example of processing multiple agencies.

```json
{
  "agencies": [
    {
      "agency_key": "myAgency",
      "path": "/path/to/the/gtfs.zip"
    },
    {
      "agency_key": "otherAgency",
      "path": "/path/to/the/othergtfs.zip"
    }
  ]
}
```

* Exclude files - if you don't want all GTFS files to be imported, you can specify an array of files to exclude.

```json
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

```json
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

### bufferSizeMeters

{Integer} Radius of buffers in meters. Optional, defaults to 400 meters (about 1/4 mile).

```json
"bufferSizeMeters": 400
```

### coordinatePrecision

{Integer} The number of decimal places to include in the latitude and longitude of coordinates and geojson simplification. Omit to avoid any rounding which will result in larger file size and longer processing time. `5` is a reasonable value (about 1.1 meters).

```json
"coordinatePrecision": 5
```

### outputType

{String} The grouping of the output. Options are "agency", "route" and "shape". Optional, defaults to `agency`.


| outputType | Description |
| ---------- | ----------- |
| `agency` | Output one geoJSON file with all routes for a single agency combined together. |
| `route` | Output one geoJSON file per route and direction. |
| `shape` | Output one geoJSON file per shape_id. |

```json
"outputType": "agency"
```

### outputFormat

{String} The format of the output. Options are "envelope", "convex", "stops", "stops-buffer", "stops-dissolved", "lines", "lines-buffer", "lines-dissolved" and "lines-and-stops". Optional, defaults to "lines-and-stops".

| Format | Type | Description | Example | geoJSON |
| ------ | ---- | ----------- | ------- | ------- |
| `envelope` | [Bounding box](http://wiki.gis.com/wiki/index.php/Minimum_bounding_rectangle) | A rectangular box around route lines. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/envelope.png"> | [envelope.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/envelope.geojson) |
| `convex` | [Convex hull](http://wiki.gis.com/wiki/index.php/Convex_hull) | A convex polygon around route endpoints. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/convex.png"> | [convex.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/convex.geojson) |
| `stops` | [Points](http://wiki.gis.com/wiki/index.php/Point_Feature_Class) | Stops as points. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/stops.png"> | [stops.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/stops.geojson) |
| `stops-buffer` | [Buffer](http://wiki.gis.com/wiki/index.php/Buffer_(GIS)) | A buffer around stops. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/stops-buffer.png"> | [stops-buffer.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/stops-buffer.geojson) |
| `stops-dissolved` | [Dissolve](http://wiki.gis.com/wiki/index.php/Dissolve) | A dissolved buffer around stops. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/stops-dissolved.png"> | [stops-dissolved.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/stops-dissolved.geojson) |
| `lines` | [Lines](http://wiki.gis.com/wiki/index.php/Line_Feature_Class) | Routes as lines. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/lines.png"> | [lines.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/lines.geojson) |
| `lines-buffer` | [Buffer](http://wiki.gis.com/wiki/index.php/Buffer_(GIS)) | A buffer around route lines. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/lines-buffer.png"> | [lines-buffer.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/lines-buffer.geojson) |
| `lines-dissolved` | [Dissolve](http://wiki.gis.com/wiki/index.php/Dissolve) | A dissolved buffer around route lines. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/lines-dissolved.png"> | [lines-dissolved.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/lines-dissolved.geojson) |
| `lines-and-stops` | Points and Lines | Both points and lines for stops and routes. | <img width="300" src="https://raw.githubusercontent.com/BlinkTagInc/gtfs-to-geojson/master/examples/lines-and-stops.png"> | [lines-and-stops.geojson](https://github.com/BlinkTagInc/gtfs-to-geojson/blob/master/examples/lines-and-stops.geojson) |

```
    "outputFormat": "lines-and-stops"
```

### sqlitePath

{String} A path to an SQLite database. Optional, defaults to using an in-memory database with a value of `:memory:`. If you want the data imported to persist, you need to specify a value for `sqlitePath`. Supports tilde as part of the path, like `~/Documents/gtfs`.

```
    "sqlitePath": "/tmp/gtfs"
```

### verbose

{Boolean} If you don't want the import script to print any output to the console, you can set `verbose` to `false`. Defaults to `true`.

```
    "verbose": false
```

### zipOutput

{Boolean} Whether or not to zip the output into one zip file named `geojson.zip`. Defaults to `false`.

```
    "zipOutput": false
```

## Running

To generate geoJSON, run `gtfs-to-geojson`.

    gtfs-to-geojson

By default, `gtfs-to-geojson` will look for a `config.json` file in the project root. To specify a different path for the configuration file:

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

This will download the GTFS file specified in `config.js` .  Then, `gtfs-to-geojson` will create geoJSON and save it to `geojson/:agency_key`.

### Options

`configPath`

    gtfs-to-geojson --configPath /path/to/your/custom-config.json

`skipImport`

Skips importing GTFS into SQLite. Useful if you are rerunning with an unchanged GTFS file. If you use this option and the GTFS file hasn't been imported or you don't have an `sqlitePath` to a non-in-memory database, you'll get an error.

    gtfs-to-geojson --skipImport


## Processing very large GTFS files.

By default, node has a memory limit of 512 MB or 1 GB. If you have a very large GTFS file, use the `max-old-space-size` option. For example to allocate 12 GB: 
  
    export NODE_OPTIONS="--max-old-space-size=30000"
    gtfs-to-geojson

### Credits

Ideas for including buffers, envelopes and convex service-area polygons came from [gtfs-service-area](https://github.com/cal-itp/gtfs-service-area).

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/gtfs-to-geojson/issues).
