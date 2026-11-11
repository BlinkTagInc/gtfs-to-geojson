import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Render the actual exported coordinates. Both views use local equirectangular projection.
export async function writePreview(directory) {
  async function load(layer) {
    return JSON.parse(
      await readFile(path.join(directory, layer + '.geojson'), 'utf8'),
    ).features;
  }
  const routes = await load('route-lines'),
    stops = await load('stop-points'),
    coverage = await load('stop-coverage');
  function panel({ x, width, center, scale, detail }) {
    const project = ([lon, lat]) => [
      (
        x +
        width / 2 +
        (lon - center[0]) * scale * Math.cos((center[1] * Math.PI) / 180)
      ).toFixed(2),
      (222 - (lat - center[1]) * scale).toFixed(2),
    ];
    const line = (coords) =>
      'M' + coords.map((p) => project(p).join(',')).join('L');
    const lines = routes
      .flatMap((f) => f.geometry.coordinates.map(line))
      .join('');
    let shapes = '';
    if (detail) {
      for (const { geometry: g } of coverage) {
        const polygons =
          g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
        shapes += polygons
          .map(
            (rings) =>
              '<path fill="#a5d6bd" fill-rule="evenodd" d="' +
              rings.map((r) => line(r) + 'Z').join('') +
              '"/>',
          )
          .join('');
      }
    }
    const markers = stops
      .map((s) => {
        const [cx, cy] = project(s.geometry.coordinates);
        return (
          '<circle cx="' +
          cx +
          '" cy="' +
          cy +
          '" r="' +
          (detail ? 3.5 : 2.4) +
          '" fill="#fff" stroke="#145846" stroke-width="1.3"/>'
        );
      })
      .join('');
    const labels = detail
      ? ['Millbrae', 'Broadway', 'Burlingame', 'San Mateo']
      : ['San Francisco', 'San Jose Diridon', 'Gilroy'];
    const text = labels
      .map((label) => {
        const f = stops.find((s) =>
          s.properties.stop_name.startsWith(label + ' Caltrain'),
        );
        if (!f) {
          return '';
        }
        const [cx, cy] = project(f.geometry.coordinates);
        const left = !detail && label === 'Gilroy';
        return (
          '<text x="' +
          (Number(cx) + (left ? -9 : 9)) +
          '" y="' +
          (Number(cy) - 4) +
          '" text-anchor="' +
          (left ? 'end' : 'start') +
          '" paint-order="stroke" stroke="#f5f7f2" stroke-width="3" fill="#133e33" font-size="12">' +
          label +
          '</text>'
        );
      })
      .join('');
    const id = detail ? 'detail' : 'overview';
    return (
      '<defs><clipPath id="' +
      id +
      '"><rect x="' +
      x +
      '" y="60" width="' +
      width +
      '" height="318"/></clipPath></defs><g clip-path="url(#' +
      id +
      ')"><rect x="' +
      x +
      '" y="60" width="' +
      width +
      '" height="318" fill="#f5f7f2"/>' +
      shapes +
      '<path fill="none" stroke="#257665" stroke-width="2" d="' +
      lines +
      '"/>' +
      markers +
      text +
      '</g>'
    );
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="840" height="422" viewBox="0 0 840 422" role="img" aria-labelledby="title desc"><title id="title">Caltrain route lines, stop points and dissolved stop buffers</title><desc id="desc">Full corridor from San Francisco to Gilroy beside a Peninsula detail showing 400-meter coverage near stations.</desc><rect width="840" height="422" fill="white"/><g font-family="system-ui,sans-serif"><g font-size="19" font-weight="600" fill="#123e34"><text x="16" y="36">Caltrain corridor</text><text x="442" y="36">Peninsula station buffers</text></g>' +
    panel({
      x: 16,
      width: 400,
      center: [-121.99, 37.39],
      scale: 365,
      detail: false,
    }) +
    panel({
      x: 440,
      width: 384,
      center: [-122.347, 37.584],
      scale: 4200,
      detail: true,
    }) +
    '<text x="16" y="405" font-size="13" fill="#335c50">Route lines and served stops · April 2016 feed</text><text x="442" y="405" font-size="13" fill="#335c50">Green polygons · 400 m from stop points</text></g></svg>\n';
  await writeFile(path.join(directory, 'preview.svg'), svg);
}
