import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('packed ESM entry, types, CLI and samples', async (t) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const temp = await mkdtemp(path.join(tmpdir(), 'geojson-package-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const packed = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        '--json',
        '--cache',
        path.join(temp, 'npm-cache'),
        '--pack-destination',
        temp,
        '--ignore-scripts',
      ],
      { cwd: root, encoding: 'utf8' },
    ),
  );
  const [pack] = Object.values(packed);
  const installed = path.join(temp, 'node_modules', 'gtfs-to-geojson');
  await writeFile(path.join(temp, 'package.json'), '{"private":true}');
  execFileSync(
    'npm',
    ['install', '--engine-strict', '--no-audit', '--no-fund', pack.filename],
    { cwd: temp, stdio: 'inherit' },
  );
  for (const file of [
    'LICENSE.txt',
    'CITATION.cff',
    'dist/index.d.ts',
    'config-sample.json',
    'config-sample-full.json',
  ]) {
    assert.ok(await readFile(path.join(installed, file)));
  }
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import assert from 'node:assert/strict'; import { exportGeoJSON } from 'gtfs-to-geojson'; assert.equal(typeof exportGeoJSON, 'function');",
    ],
    { cwd: temp },
  );
  const cli = path.join(temp, 'node_modules/.bin/gtfs-to-geojson');
  assert.equal(
    execFileSync(process.execPath, [cli, '-v'], { encoding: 'utf8' }).trim(),
    pack.version,
  );
  execFileSync(
    process.execPath,
    [
      cli,
      '--input',
      path.join(root, 'test/fixtures/caltrain_20160406.zip'),
      '--output',
      path.join(temp, 'out'),
      '--log-level',
      'silent',
    ],
    { cwd: temp },
  );
  assert.equal(
    JSON.parse(
      await readFile(path.join(temp, 'out/default/stop-points.geojson')),
    ).features.length,
    64,
  );
});
