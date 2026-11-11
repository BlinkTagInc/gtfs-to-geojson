# SFMTA export benchmark

A local SFMTA GTFS ZIP (10 MiB compressed) contained 68 routes, 50,690 trips, 45,308 shape points and 1,901,119 stop times. The comparison used Node.js 26.13 on Apple silicon, SQLite on local disk, and the same node-GTFS 5.0.0-beta.0 dependency for both package versions.

| Route lines grouped by route and direction  |  v3.9.0 |      v4 |
| ------------------------------------------- | ------: | ------: |
| Import ZIP into a fresh database and export | 16.54 s | 14.32 s |
| Export from the same existing database      |  3.96 s |  0.59 s |

These are wall-clock measurements from one run per case. All 135 exported groups had equivalent line segment sets across versions (26,321 segments total). The line-only export uses the trip-to-shape relationships and skips reading stop times when all selected trips have shapes. Unshaped trips and grouped stop layers need stop-time membership. Dissolving polygons incurs additional spatial processing.

On the same stored feed, the default source-wide export produced 68 route lines and 3,238 stop points in 1.32 seconds. Dissolving 400-meter buffers around those stops took 22.00 seconds and produced one MultiPolygon.

To repeat with a local feed, run in a directory without a default config file and choose an unused database and output path for the first command.

```sh
time gtfs-to-geojson --input ./sfmta.zip --database ./sfmta.sqlite \
  --source-id sfmta --group-by route-direction --layer route-lines \
  --output ./with-import --log-level silent

time gtfs-to-geojson --database ./sfmta.sqlite \
  --source-id sfmta --group-by route-direction --layer route-lines \
  --output ./from-database --log-level silent
```

For the v3 comparison, use the same source ID, set `outputType` to `route` and `outputFormat` to `lines`, and run the second case with `skipImport: true`.
