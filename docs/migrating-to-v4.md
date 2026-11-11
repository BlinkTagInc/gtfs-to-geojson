# Migrating from v3

Start with the [minimal config](../config-sample.json). The CLI command is `gtfs-to-geojson`. Use `--config` or `-c` to select a config file. In JavaScript, replace the default converter import with the named `exportGeoJSON` function and read `result.files` or `result.archivePath`.

| v3                                                  | v4                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `agencies[].agencyKey` or `agency_key`              | `sources[].sourceId`. Identifies a feed, which can contain multiple GTFS agencies.                           |
| `agencies[].path`, `url`, `headers`, `exclude`      | `sources[].schedule.path`, `url`, `requestHeaders`, `excludeFiles`. Use full filenames such as `shapes.txt`. |
| `fillEmptyAgencyId` and `agencyId`                  | `sources[].schedule.defaultAgencyId`                                                                         |
| `sqlitePath`, `db`                                  | `database.path` or JavaScript `database.client`                                                              |
| `skipImport`                                        | Configure the stored source ID and omit its schedule.                                                        |
| `ignoreDuplicates`, `csvOptions`, `downloadTimeout` | `schedule.import.validation.onDuplicateKey`, `schedule.import.csv`, `schedule.timeoutMs`                     |
| `outputType: agency / route / shape`                | `export.groupBy: source / route-direction / shape`. Use the new `route` group to combine both directions.    |
| `outputFormat`                                      | `export.layers`, an array of named layers                                                                    |
| `lines / stops / lines-and-stops`                   | `route-lines / stop-points / network`                                                                        |
| `lines-buffer / stops-buffer`                       | `route-buffers / stop-buffers`                                                                               |
| `lines-dissolved / stops-dissolved`                 | `route-coverage / stop-coverage`                                                                             |
| `envelope / convex`                                 | `bounding-box / convex-hull`                                                                                 |
| `outputPath / overwriteExistingFiles / zipOutput`   | `export.outputDirectory / overwrite / archive`                                                               |
| `bufferSizeMeters / coordinatePrecision`            | `export.bufferRadiusMeters / coordinateDecimals`. Precision now only rounds coordinates.                     |
| `startDate / endDate`                               | `export.serviceDate` as a numeric YYYYMMDD or an object with inclusive `start` and/or `end`.                 |
| `verbose / logLevel / logFunction`                  | `reporting.level` and `reporting.reporter`. CLI levels are silent, error, warn and info.                     |

The default export now creates separate route-line and stop-point layers. Select `["network"]` for a combined map. Every output is a FeatureCollection, including a lone dissolved polygon or a layer with zero features. New paths use source and group subdirectories. Consumers that globbed the old flat output can read `geojson-manifest.json` instead. The previous `log.txt` is replaced by structured reporting and the manifest.

Choose a new directory for the first v4 export. Subsequent runs can replace that dataset with `export.overwrite`. Dates now account for service weekdays and both types of calendar exceptions. Shape-less trips contribute their own ordered stop paths, including when another trip on the same route has a shape.
