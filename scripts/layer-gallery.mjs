import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportGeoJSON } from '../dist/index.js';

const layers = [
  'route-lines',
  'shape-lines',
  'stop-points',
  'network',
  'service-areas',
  'route-buffers',
  'route-coverage',
  'stop-buffers',
  'stop-coverage',
  'bounding-box',
  'convex-hull',
];
const colors = ['#13645b', '#b45025', '#6351a0'];
// Use the same local projection and viewport for every layer of the example feed.
function project([lon, lat]) {
  return [160 + (lon + 122.4295) * 5220, 124 - (lat - 37.767) * 6600].map((n) =>
    n.toFixed(1),
  );
}
function line(coords) {
  return 'M' + coords.map((p) => project(p).join(',')).join('L');
}
function draw(feature, index, layer) {
  const { type, coordinates } = feature.geometry;
  const color = colors[index % colors.length];
  if (type === 'Point') {
    const [x, y] = project(coordinates);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="white" stroke="#173e42" stroke-width="2.5"/>`;
  }
  if (type === 'LineString' || type === 'MultiLineString') {
    const paths = type === 'LineString' ? [coordinates] : coordinates;
    // Dashes reveal coincident paths belonging to different features.
    const dash =
      index > 0
        ? ' stroke-dasharray="' + (index === 1 ? '7 5' : '2 5') + '"'
        : '';
    return `<path d="${paths.map(line).join('')}" fill="none" stroke="${color}" stroke-width="3.5"${dash}/>`;
  }
  const polygons = type === 'Polygon' ? [coordinates] : coordinates;
  const fill = layer.endsWith('buffers') ? color : '#13645b';
  return polygons
    .map(
      (rings) =>
        `<path d="${rings.map((r) => line(r) + 'Z').join('')}" fill="${fill}" fill-opacity=".28" fill-rule="evenodd" stroke="${fill}" stroke-width="1.8"/>`,
    )
    .join('');
}

export async function writeLayerGallery(root, temp) {
  const result = await exportGeoJSON({
    sources: [
      {
        sourceId: 'gallery',
        schedule: { path: path.join(root, 'test/fixtures/gallery') },
      },
    ],
    export: {
      outputDirectory: path.join(temp, 'gallery-export'),
      layers,
      bufferRadiusMeters: 400,
      coordinateDecimals: 6,
    },
  });
  const directory = path.join(root, 'examples/gallery');
  await mkdir(directory, { recursive: true });
  for (const file of result.files) {
    const layer = path.basename(file, '.geojson');
    const json = await readFile(
      path.join(result.outputDirectory, file),
      'utf8',
    );
    const { features } = JSON.parse(json);
    if (!features.length) {
      throw new Error('Gallery layer is empty: ' + layer);
    }
    const count =
      features.length + ' ' + (features.length === 1 ? 'feature' : 'features');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 265" width="320" height="265" role="img" aria-labelledby="title"><title id="title">${layer}, ${count}</title>
<rect width="320" height="265" rx="8" fill="#f5f7f2"/>
<g stroke-linecap="round" stroke-linejoin="round">${features.map((f, i) => draw(f, i, layer)).join('\n')}</g>
<text x="12" y="254" font-family="system-ui,sans-serif" font-size="13" fill="#465d58">${count}</text></svg>\n`;
    await writeFile(path.join(directory, layer + '.svg'), svg);
    await writeFile(path.join(directory, layer + '.geojson'), json);
  }
}
