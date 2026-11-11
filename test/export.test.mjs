import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportGeoJSON } from '../dist/index.js';

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
  files.calendar_dates =
    'service_id,date,exception_type\nS,20260115,2\nT,20260115,1';
  for (const [key, value] of Object.entries(files)) {
    await writeFile(path.join(directory, key + '.txt'), value + '\n');
  }
}

async function setup(t) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'gtfs-geojson-test-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  await makeFeed(path.join(tmp, 'North'), 'North');
  return {
    tmp,
    source: { sourceId: 'north', schedule: { path: path.join(tmp, 'North') } },
    out: path.join(tmp, 'out'),
  };
}
const cli = new URL('../dist/bin/gtfs-to-geojson.js', import.meta.url).pathname;
async function features(out, file) {
  const collection = JSON.parse(await readFile(path.join(out, file), 'utf8'));
  assert.equal(collection.type, 'FeatureCollection');
  return collection.features;
}
test('isolates shared IDs across sources, routes, directions and archives', async (t) => {
  const { tmp, source, out } = await setup(t);
  await makeFeed(path.join(tmp, 'South'), 'South');
  const database = { path: path.join(tmp, 'transit.sqlite') };
  const result = await exportGeoJSON({
    database,
    sources: [
      source,
      { sourceId: 'south', schedule: { path: path.join(tmp, 'South') } },
    ],
    export: { outputDirectory: out, groupBy: 'route-direction', archive: true },
  });
  assert.equal(result.files.length, 8);
  const entries = execFileSync('unzip', ['-Z1', result.archivePath], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .sort();
  assert.deepEqual(entries, result.files);
  for (const sourceId of ['north', 'south']) {
    for (const dir of [0, 1]) {
      const folder = sourceId + '/route-direction/R/' + dir + '/';
      const [line] = await features(out, folder + 'route-lines.geojson');
      assert.equal(
        line.properties.agency_name,
        sourceId === 'north' ? 'North' : 'South',
      );
      assert.equal(line.properties.direction_id, dir);
      assert.deepEqual(line.geometry.coordinates, [
        dir === 0
          ? [
              [-122, 37],
              [-122.1, 37.1],
            ]
          : [
              [-122.1, 37.1],
              [-122.2, 37.2],
            ],
      ]);
      assert.deepEqual(
        (await features(out, folder + 'stop-points.geojson'))
          .map((f) => f.properties.stop_id)
          .sort(),
        dir === 0 ? ['a', 'b'] : ['b', 'c'],
      );
    }
  }
  const config = path.join(tmp, 'config.json');
  await writeFile(
    config,
    JSON.stringify({
      database,
      sources: [{ sourceId: 'north' }],
      export: { outputDirectory: out, overwrite: true, groupBy: 'route' },
    }),
  );
  assert.equal(
    execFileSync(
      process.execPath,
      [
        cli,
        'export',
        '-c',
        config,
        '--service-date',
        '20260115',
        '--log-level',
        'silent',
      ],
      { cwd: tmp, encoding: 'utf8' },
    ),
    '',
  );
  assert.deepEqual(
    (await features(out, 'north/route/R/stop-points.geojson'))
      .map((f) => f.properties.stop_id)
      .sort(),
    ['b', 'c'],
  );
  await assert.rejects(readFile(path.join(out, result.files[0])), {
    code: 'ENOENT',
  });
});

test('inclusive range applies calendar exceptions and shape fallback follows trip order', async (t) => {
  const { source, out } = await setup(t);
  const config = {
    sources: [
      {
        ...source,
        schedule: { ...source.schedule, excludeFiles: ['shapes.txt'] },
      },
    ],
    export: {
      outputDirectory: out,
      serviceDate: { start: 20260115, end: 20260115 },
      layers: ['route-lines', 'stop-points'],
    },
  };
  await exportGeoJSON(config);
  assert.deepEqual(
    (await features(out, 'north/route-lines.geojson'))[0].geometry.coordinates,
    [
      [
        [-122.1, 37.1],
        [-122.2, 37.2],
      ],
    ],
  );
  const rangeStops = await features(out, 'north/stop-points.geojson');
  await exportGeoJSON({
    ...config,
    export: { ...config.export, overwrite: true, serviceDate: 20260115 },
  });
  assert.deepEqual(
    await features(out, 'north/stop-points.geojson'),
    rangeStops,
  );
  await exportGeoJSON({
    ...config,
    export: {
      ...config.export,
      overwrite: true,
      serviceDate: { start: 20270101, end: 20270107 },
    },
  });
  assert.deepEqual(await features(out, 'north/stop-points.geojson'), []);
});

test('empty hull is valid GeoJSON and warnings identify each group', async (t) => {
  const { source, out } = await setup(t);
  const events = [];
  const config = {
    sources: [source],
    reporting: { reporter: (e) => events.push(e), level: 'warn' },
    export: {
      outputDirectory: out,
      groupBy: 'shape',
      layers: ['convex-hull', 'shape-lines'],
    },
  };
  await exportGeoJSON(config);
  for (const shape of ['s0', 's1']) {
    assert.deepEqual(
      await features(out, 'north/shape/' + shape + '/convex-hull.geojson'),
      [],
    );
    assert.equal(
      (await features(out, 'north/shape/' + shape + '/shape-lines.geojson'))[0]
        .properties.shape_id,
      shape,
    );
    assert.ok(
      events.some(
        (e) =>
          e.message.includes('north/shape/' + shape) &&
          e.message.includes('non-collinear'),
      ),
    );
  }
});

test('shows the JSON array syntax for a single layer supplied as a string', async () => {
  await assert.rejects(exportGeoJSON({ export: { layers: 'stop-points' } }), {
    message:
      'export.layers must be an array of layer names. Received the string "stop-points". Example: "layers": ["stop-points"].',
  });
});

test('invalid options, unrelated files and failed regeneration preserve published output', async (t) => {
  const { source, out } = await setup(t);
  const config = {
    sources: [source],
    export: { outputDirectory: out, overwrite: true },
  };
  await exportGeoJSON(config);
  const manifest = path.join(out, 'geojson-manifest.json');
  const before = await readFile(manifest, 'utf8');
  await assert.rejects(
    exportGeoJSON({
      ...config,
      sources: [{ schedule: { path: out + '/missing.zip' } }],
    }),
  );
  await assert.rejects(
    exportGeoJSON({
      ...config,
      export: { ...config.export, serviceDate: 20260230 },
    }),
    /real numeric/,
  );
  await writeFile(path.join(out, 'notes.txt'), 'keep');
  await assert.rejects(exportGeoJSON(config), /unrelated/);
  assert.equal(await readFile(manifest, 'utf8'), before);
  assert.equal(await readFile(path.join(out, 'notes.txt'), 'utf8'), 'keep');
});

test('Flex polygons follow the selected trips and retain their GTFS IDs', async (t) => {
  const { tmp, source, out } = await setup(t);
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [-122, 37],
        [-122.1, 37],
        [-122.1, 37.1],
        [-122, 37],
      ],
    ],
  };
  await writeFile(
    path.join(tmp, 'North', 'locations.geojson'),
    JSON.stringify({
      type: 'FeatureCollection',
      features: ['west', 'east'].map((id) => ({
        id,
        type: 'Feature',
        geometry,
        properties: { stop_name: id },
      })),
    }),
  );
  await writeFile(
    path.join(tmp, 'North', 'stop_times.txt'),
    'trip_id,location_id,stop_sequence,start_pickup_drop_off_window,end_pickup_drop_off_window\nt0,west,1,08:00:00,09:00:00\nt1,east,1,08:00:00,09:00:00\n',
  );
  await exportGeoJSON({
    sources: [source],
    export: {
      outputDirectory: out,
      layers: ['service-areas'],
      groupBy: 'route-direction',
      serviceDate: 20260115,
    },
  });
  const rows = await features(
    out,
    'north/route-direction/R/1/service-areas.geojson',
  );
  assert.deepEqual(
    rows.map((f) => f.id),
    ['east'],
  );
  assert.deepEqual(rows[0].geometry, geometry);
});

test('selects one stored source with a one-sided service range', async (t) => {
  const { source, tmp, out } = await setup(t);
  const database = { path: path.join(tmp, 'db.sqlite') };
  await exportGeoJSON({
    database,
    sources: [source],
    export: { outputDirectory: out },
  });
  const config = {
    database,
    export: {
      outputDirectory: out,
      overwrite: true,
      sourceId: 'north',
      serviceDate: { start: 20260701 },
    },
  };
  await exportGeoJSON(config);
  assert.deepEqual(
    (await features(out, 'north/stop-points.geojson'))
      .map((f) => f.properties.stop_id)
      .sort(),
    ['b', 'c'],
  );
});

test('v3 configuration and CLI options are rejected', async (t) => {
  const { source, out, tmp } = await setup(t);
  const config = { sources: [source], export: { outputDirectory: out } };
  for (const key of [
    'agencies',
    'sqlitePath',
    'db',
    'skipImport',
    'ignoreDuplicates',
    'downloadTimeout',
    'csvOptions',
    'gtfsToGeoJSONVersion',
    'logFunction',
    'bufferSizeMeters',
    'coordinatePrecision',
    'logLevel',
    'outputType',
    'outputFormat',
    'outputPath',
    'overwriteExistingFiles',
    'startDate',
    'endDate',
    'verbose',
    'zipOutput',
  ]) {
    await assert.rejects(exportGeoJSON({ ...config, [key]: false }), {
      message: 'Unknown configuration option: ' + key,
    });
  }
  for (const key of [
    'agencyKey',
    'agency_key',
    'path',
    'url',
    'exclude',
    'headers',
    'fillEmptyAgencyId',
    'agencyId',
  ]) {
    await assert.rejects(
      exportGeoJSON({ ...config, sources: [{ ...source, [key]: 'legacy' }] }),
      new RegExp(key),
    );
  }
  for (const value of [
    'lines',
    'stops',
    'lines-and-stops',
    'envelope',
    'convex',
    'lines-buffer',
    'stops-buffer',
    'lines-dissolved',
    'stops-dissolved',
  ]) {
    await assert.rejects(
      exportGeoJSON({ ...config, export: { layers: [value] } }),
      /export.layers/,
    );
  }
  for (const flag of ['--configPath', '--skipImport', '-s']) {
    const result = spawnSync(process.execPath, [cli, flag], {
      cwd: tmp,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option/);
  }
});
