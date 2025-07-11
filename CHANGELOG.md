# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.8.3] - 2025-05-28
### Updated
- Dependency updates

## [3.8.2] - 2025-04-17
### Updated
- Dependency updates

## [3.8.1] - 2025-03-31

### Updated
- Avoid blank components to export file names
- Use agency from GTFS as fallback agencyKey

### Added
- outputPath config option

## [3.8.0] - 2025-03-30

### Updated
- Rename agency_key to agencyKey
- Return path to zipped file if zipOutput=true

## [3.7.11] - 2025-03-30

### Updated
- Change to package.json version import
- Dependency updates
- Remove package-lock.json

## [3.7.10] - 2025-02-25

### Updated
- Dependency updates

## [3.7.9] - 2024-11-18

### Updated
- Dependency updates

## [3.7.8] - 2024-10-24

### Updated
- Updated logging functions
- Return geojson paths
- Dependency updates

## [3.7.7] - 2024-09-23

### Updated
- Added release-it build hook
- Dependency updates

## [3.7.6] - 2024-08-03

### Updated
- Dependency updates
- Updates to handle lines as MultiLineString

## [3.7.5] - 2024-07-18

### Fixed
- Fix for fetching version

### Updated
- Dependency updates

## [3.7.4] - 2024-07-12

### Updated
- Handle GTFS with no calendars
- Dependency updates

## [3.7.3] - 2024-06-22

### Updated
- Typescript

## [3.7.2] - 2024-06-19

## Updated

- Updated geoJSON filenames to be unique
- Improved error formatting

## [3.7.1] - 2024-06-19

## Fixed

 - Handle duplicate geojson filenames

 ## Added

- Progress Bar

## Updated

- Limit concurrency

## [3.7.0] - 2024-06-18

## Updated

 - Dependency updates
 - Additional GTFS files to exclude

## Fixed

- Improved dissolve function
- Fix for adding properties
- Fix for convex calculation

## [3.6.1] - 2024-04-09

## Added

- Use route_attributes fields as geoJSON properties on routes

## Updated

 - Dependency updates

## [3.6.0] - 2024-03-09

## Added

- startDate and endDate config params

## Updated

 - Dependency updates

## [3.5.0] - 2024-03-01

### Updated

- Dependency updates

### Added

- Support for creating geoJSON lines from GTFS without shapes.txt

## [3.4.4] - 2023-10-03

### Updated

- Dependency updates

### Changed

- Exclude unnecessary GTFS files

## [3.4.3] - 2023-07-18

### Updated

- Dependency updates

## [3.4.2] - 2023-07-08

### Changed

- Use lint-staged instead of pretty-quick

### Updated

- Dependency updates

## [3.4.1] - 2023-07-01

### Updated

- Dependency updates

## [3.4.0] - 2023-01-15

### Updated

- Exclude stops not used in any routes
- Update Bay Area example
- Dependency updates

## [3.3.1] - 2022-12-31

### Updated

- Dependency updates

## [3.3.0] - 2022-12-30

### Updated

- Dependency updates
- node-gtfs v4

## [3.2.0] - 2022-09-13

### Updated

- Better dissolve function for handling large numbers of stops or lines.
- Use yoctocolors instead of chalk
- Dependency updates

## [3.1.0] - 2022-04-29

### Added

- Added support for generating one geoJSON file per GTFS shape_id.

## [3.0.6] - 2022-04-26

### Updated

- Dependency updates

## [3.0.5] - 2022-04-09

### Updated

- Dependency updates
- Readme improvements

## [3.0.4] - 2021-09-25

### Updated

- Dependency updates

## [3.0.3] - 2021-08-02

### Updated

- Dependency updates
- Speed up GTFS import

## [3.0.2] - 2021-06-15

### Updated

- Dependency updates
- Use eslint instead of xo

## [3.0.1] - 2021-05-26

### Fixed

- Parsing CLI arguments

### Updated

- Dependency updates

## [3.0.0] - 2021-05-13

### Breaking Changes

- Converted to ES Module

## [2.0.6] - 2021-05-06

### Updated

- Dependency updates
- Documentation updates

## [2.0.5] - 2021-02-09

### Updated

- Dependency updates

## [2.0.4] - 2021-01-18

### Updated

- Simplify buffer geojson before union
- Better logging
- Documentation improvements
- Dependency updates

## [2.0.3] - 2020-12-10

### Updated

- Dependency updates (fixes https://github.com/advisories/GHSA-qqgx-2p2h-9c37)

## [2.0.2] - 2020-12-05

### Updated

- Better documentation on processing multiple agencies
- Dependency updates

## [2.0.1] - 2020-11-19

### Changed

- Better dissolve with polygon-clipping library

### Fixed

- Support for multi agency import

## [2.0.0] - 2020-11-19

### Added

- New export types: envelope, convex, lines, lines-buffer, lines-dissolve, stops, stops-buffer, stops-dissolve, lines-and-stops.

### Changed

- Changed config options

## [1.0.5] - 2020-11-10

### Added

- Better geoJSON merge

### Fixed

- Handle no config.coordinatePrecision

## [1.0.4] - 2020-10-13

### Added

- Support for extended GTFS route types

## [1.0.3] - 2020-10-13

### Updated

- Dependency updates

### Fixed

- Improved error logging

## [1.0.2] - 2020-09-12

### Updated

- Dependency updates

### Fixed

- Improved logging and config parsing

## [1.0.1] - 2020-09-10

### Updated

- Dependency updates

## [1.0.0] - 2020-08-20

### Updated

- Use node-gtfs 2.0.0 with SQLite
- Remove mongoDB
- Documentation updates

## [0.5.4] - 2020-07-15

### Updated

- Dependency updates

## [0.5.3] - 2020-06-28

### Updated

- Better mongo connection details

### Fixed

- Improved error handling for geojson simplification

## [0.5.2] - 2020-06-04

### Added

- Improved geojson simplification from turfjs

### Updated

- Dependency updates

## [0.5.1] - 2020-05-10

### Updated

- Dependency updates

## [0.5.0] - 2019-02-28

### Added

- Changelogs

### Changed

- Updated dependencies to fix issue with geojson consolidation
