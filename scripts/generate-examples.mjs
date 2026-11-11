import { mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportGeoJSON } from '../dist/index.js';

import { writeLayerGallery } from './layer-gallery.mjs';
import { writePreview } from './preview.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'caltrain-examples-'));
try {
  await exportGeoJSON({
    sources: [
      {
        sourceId: 'caltrain',
        schedule: {
          path: path.join(root, 'test/fixtures/caltrain_20160406.zip'),
        },
      },
    ],
    export: {
      outputDirectory: temp,
      coordinateDecimals: 6,
      bufferRadiusMeters: 400,
      layers: [
        'route-lines',
        'shape-lines',
        'stop-points',
        'network',
        'stop-buffers',
        'stop-coverage',
        'route-buffers',
        'route-coverage',
        'convex-hull',
        'bounding-box',
      ],
    },
  });
  await cp(path.join(temp, 'caltrain'), path.join(root, 'examples/caltrain'), {
    recursive: true,
  });
  await writePreview(path.join(root, 'examples/caltrain'));
  await writeLayerGallery(root, temp);
} finally {
  await rm(temp, { recursive: true, force: true });
}
