import bbox from '@turf/bbox';
import bboxPolygon from '@turf/bbox-polygon';
import buffer from '@turf/buffer';
import convex from '@turf/convex';
import union from '@turf/union';
import { featureCollection } from '@turf/helpers';
import { coordEach } from '@turf/meta';
import type { Feature, FeatureCollection } from 'geojson';
import type { Layer, ExportSettings } from '../config.ts';
import type { GroupGeometry } from './groups.ts';

export function buildLayer(
  layer: Layer,
  group: GroupGeometry,
  settings: ExportSettings,
  sourceId: string,
  warn: (message: string) => void,
): FeatureCollection {
  const properties = {
    source_id: sourceId,
    ...(settings.groupBy === 'shape' && { shape_id: group.ids[0] }),
    ...(['route', 'route-direction'].includes(settings.groupBy) && {
      route_id: group.ids[0],
    }),
    ...(settings.groupBy === 'route-direction' && {
      direction_id:
        group.ids[1] === 'unspecified' ? null : Number(group.ids[1]),
    }),
  };
  let features: Feature[];
  switch (layer) {
    case 'service-areas':
      features = group.areas;
      break;
    case 'stop-points':
      features = group.points;
      break;
    case 'shape-lines':
      features = group.shapes;
      break;
    case 'route-lines':
      features = group.lines;
      break;
    case 'network':
      features = [...group.lines, ...group.points];
      break;
    case 'bounding-box': {
      features = [];
      if (group.lines.length) {
        const bounds = bbox(featureCollection(group.lines));
        if (bounds[0] !== bounds[2] && bounds[1] !== bounds[3]) {
          const polygon = bboxPolygon(bounds, { properties });
          delete polygon.bbox;
          features.push(polygon);
        } else {
          warn('Bounding box has zero area.');
        }
      }
      break;
    }
    case 'convex-hull': {
      const hull = convex(featureCollection(group.points), { properties });
      features = hull ? [hull] : [];
      if (!hull) {
        warn(
          'Convex hull requires at least three non-collinear stop locations.',
        );
      }
      break;
    }
    default: {
      const input: Feature[] = layer.startsWith('stop-')
        ? group.points
        : group.lines;
      const polygons =
        buffer(featureCollection(input), settings.bufferRadiusMeters, {
          units: 'meters',
        })?.features ?? [];
      if (layer.endsWith('-coverage') && polygons.length) {
        const dissolved =
          polygons.length === 1
            ? polygons[0]
            : union(featureCollection(polygons));
        if (!dissolved) {
          throw new Error('Unable to dissolve ' + layer);
        }
        features = [{ ...dissolved, properties }];
      } else {
        features = polygons;
      }
    }
  }
  const collection = featureCollection(features);
  if (settings.coordinateDecimals === undefined) {
    return collection;
  }
  const rounded = structuredClone(collection);
  const scale = 10 ** settings.coordinateDecimals;
  coordEach(rounded, (position) => {
    position.forEach((value, index) => {
      position[index] = Math.round(value * scale) / scale;
    });
  });
  return rounded;
}
