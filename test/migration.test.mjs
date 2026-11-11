import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import convert from '../dist/index.js';

async function makeFeed(directory, name) {
  await mkdir(directory);
  const files = {
    agency: `agency_id,agency_name,agency_url,agency_timezone\nA,${name},https://example.org,America/Los_Angeles`,
    routes: 'route_id,agency_id,route_short_name,route_type\nR,A,1,3',
    calendar:
      'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nS,1,1,1,1,1,1,1,20260101,20260131\nT,1,1,1,1,1,1,1,20260701,20260731',
    trips:
      'route_id,service_id,trip_id,trip_headsign,direction_id,shape_id\nR,S,t0,Town,0,s0\nR,T,t1,Town,1,s1',
    stops:
      'stop_id,stop_name,stop_lat,stop_lon\na,First,37,-122\nb,Second,37.1,-122.1\nc,Third,37.2,-122.2',
    stop_times:
      'trip_id,stop_id,stop_sequence,arrival_time,departure_time\nt0,a,1,08:00:00,08:00:00\nt0,b,2,08:10:00,08:10:00\nt1,b,1,09:00:00,09:00:00\nt1,c,2,09:10:00,09:10:00',
    shapes:
      'shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon\ns0,1,37,-122\ns0,2,37.1,-122.1\ns1,1,37.1,-122.1\ns1,2,37.2,-122.2',
  };
  for (const [key, value] of Object.entries(files))
    await writeFile(path.join(directory, key + '.txt'), value + '\n');
}

test('scopes shared IDs, directions and service ranges; reopens a feed from the CLI', async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'gtfs-to-geojson-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const read = async (dir, name) =>
    JSON.parse(await readFile(path.join(dir, name + '.geojson'), 'utf8'));
  const sqlitePath = path.join(tmp, 'v5.sqlite');
  for (const name of ['North', 'South']) {
    const feedPath = path.join(tmp, name);
    await makeFeed(feedPath, name);
    const outputPath = path.join(tmp, name + '-route');
    await convert({
      sqlitePath,
      agencies: [{ agencyKey: name, path: feedPath }],
      outputPath,
      outputType: 'route',
      logLevel: 'silent',
    });
    for (const direction of [0, 1]) {
      const { features } = await read(outputPath, 'A_R_' + direction);
      assert.equal(features[0].properties.agency_name, name);
      assert.equal(features[0].geometry.type, 'MultiLineString');
      const coords =
        direction === 0
          ? [
              [-122, 37],
              [-122.1, 37.1],
            ]
          : [
              [-122.1, 37.1],
              [-122.2, 37.2],
            ];
      assert.deepEqual(features[0].geometry.coordinates, [coords]);
      assert.deepEqual(
        features
          .slice(1)
          .map((f) => f.properties.stop_id)
          .sort(),
        direction === 0 ? ['a', 'b'] : ['b', 'c'],
      );
    }
  }
  const config = {
    sqlitePath,
    agencies: [{ agencyKey: 'North' }],
    outputPath: path.join(tmp, 'january'),
    startDate: '20260115',
    endDate: '20260130',
    logLevel: 'silent',
  };
  const configPath = path.join(tmp, 'config.json');
  await writeFile(configPath, JSON.stringify(config));
  execFileSync(process.execPath, [
    new URL('../dist/bin/gtfs-to-geojson.js', import.meta.url).pathname,
    '--configPath',
    configPath,
    '--skipImport',
  ]);
  const { features } = await read(config.outputPath, 'North');
  assert.equal(features[0].properties.agency_name, 'North');
  assert.deepEqual(features[0].geometry.coordinates, [
    [
      [-122, 37],
      [-122.1, 37.1],
    ],
  ]);
  assert.equal(features.length, 3);

  await convert({
    ...config,
    agencies: [
      {
        agencyKey: 'missing-shapes',
        path: path.join(tmp, 'North'),
        exclude: ['shapes'],
      },
    ],
    outputFormat: 'lines',
  });
  const fallback = await read(config.outputPath, 'missing-shapes');
  assert.equal(fallback.features[0].geometry.type, 'LineString');
  assert.deepEqual(fallback.features[0].geometry.coordinates, [
    [-122, 37],
    [-122.1, 37.1],
  ]);
});
test('convex warnings identify each route direction and report the number of distinct locations', async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'gtfs-convex-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const feedPath = path.join(tmp, 'feed');
  await makeFeed(feedPath, 'North');
  const messages = [];
  const config = {
    agencies: [{ agencyKey: 'North', path: feedPath }],
    outputPath: path.join(tmp, 'out'),
    outputFormat: 'convex',
    logFunction: (message) => messages.push(message),
  };
  await convert({ ...config, outputType: 'route' });
  await convert({
    ...config,
    outputType: 'agency',
    startDate: '20260101',
    endDate: '20260131',
  });
  assert.deepEqual(
    messages
      .filter((m) => m.startsWith('Unable to calculate convex hull'))
      .sort(),
    [
      'Unable to calculate convex hull for agency North.',
      'Unable to calculate convex hull for agency North, route_id=R, direction_id=0.',
      'Unable to calculate convex hull for agency North, route_id=R, direction_id=1.',
    ]
      .map(
        (prefix) =>
          prefix +
          ' Found 2 stops with coordinates at 2 distinct locations. A hull requires at least three non-collinear locations.',
      )
      .sort(),
  );
});
