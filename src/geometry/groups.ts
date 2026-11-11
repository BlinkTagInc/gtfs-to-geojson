import type {
  Gtfs,
  GtfsRouteGeoJSONProperties,
  GtfsShapeGeoJSONProperties,
  GtfsStopGeoJSONProperties,
} from 'gtfs';
import type {
  Feature,
  LineString,
  MultiLineString,
  Point,
  Polygon,
  MultiPolygon,
  Position,
} from 'geojson';
import { multiLineString } from '@turf/helpers';
import type { ExportSettings } from '../config.ts';
import { servicesInRange } from './service.ts';

interface RoutePaths {
  shapeIds: Set<string>;
  sequences: Map<string, Position[]>;
}
interface Group {
  ids: string[];
  routes: Map<string, RoutePaths>;
  stops: Set<string>;
  shapes: Set<string>;
  areas: Set<string>;
}

// Preserve the original order along each path and never bridge a gap between paths.
function uniqueSegments(paths: Position[][]) {
  const seen = new Set<string>(),
    lines: Position[][] = [];
  for (const path of paths) {
    let line: Position[] = [];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      if (!a || !b) {
        continue;
      }
      const left = a.join(','),
        right = b.join(',');
      if (left === right) {
        continue;
      }
      const key = left < right ? left + '|' + right : right + '|' + left;
      if (seen.has(key)) {
        line = [];
        continue;
      }
      seen.add(key);
      if (!line.length) {
        line = [a];
        lines.push(line);
      }
      line.push(b);
    }
  }
  return lines;
}

export async function* readGroups(
  gtfs: Gtfs,
  sourceId: string,
  settings: ExportSettings,
): AsyncGenerator<GroupGeometry> {
  const { groupBy, layers, serviceDate } = settings;
  const unfilteredSource = groupBy === 'source' && serviceDate === undefined;
  const needStops = layers.some((l) =>
    [
      'network',
      'stop-points',
      'stop-buffers',
      'stop-coverage',
      'convex-hull',
    ].includes(l),
  );
  const needRoutes = layers.some((l) =>
    [
      'network',
      'route-lines',
      'route-buffers',
      'route-coverage',
      'bounding-box',
    ].includes(l),
  );
  const needAreas = layers.includes('service-areas');
  const locations = needAreas ? await gtfs.schedule.locations.all() : [];
  const byArea = new Map(
    locations.map((row) => [
      row.id,
      {
        type: 'Feature' as const,
        id: row.id,
        geometry: JSON.parse(row.geometry) as Polygon | MultiPolygon,
        properties: {
          source_id: sourceId,
          stop_name: row.stop_name,
          stop_desc: row.stop_desc,
        },
      },
    ]),
  );
  const needShapes =
    needRoutes || layers.includes('shape-lines') || groupBy === 'shape';
  const shapes = needShapes ? (await gtfs.geojson.shapes()).features : [];
  const byShape = new Map(shapes.map((f) => [f.properties.shape_id, f]));
  const props = new Map<string, GtfsRouteGeoJSONProperties>();
  for (const shape of shapes) {
    for (const route of shape.properties.routes) {
      props.set(route.route_id, route);
    }
  }
  const query = gtfs.schedule.trips.select(
    'route_id',
    'direction_id',
    'trip_id',
    'shape_id',
    'service_id',
  );
  const trips =
    unfilteredSource && !needRoutes
      ? []
      : await (
          typeof serviceDate === 'number' ? query.where({ serviceDate }) : query
        ).all();
  const services =
    typeof serviceDate === 'object'
      ? await servicesInRange(gtfs, serviceDate.start, serviceDate.end)
      : undefined;
  const groups = new Map<string, Group>();
  function groupFor(ids: string[]) {
    const key = JSON.stringify(ids);
    let group = groups.get(key);
    if (!group) {
      group = {
        ids,
        routes: new Map(),
        stops: new Set(),
        shapes: new Set(),
        areas: new Set(),
      };
      groups.set(key, group);
    }
    return group;
  }
  if (groupBy === 'source') {
    groupFor([]);
  }
  if (
    serviceDate === undefined &&
    (groupBy === 'shape' ||
      (groupBy === 'source' && layers.includes('shape-lines')))
  ) {
    for (const shape of shapes) {
      const id = shape.properties.shape_id;
      groupFor(groupBy === 'shape' ? [id] : []).shapes.add(id);
    }
  }
  if (needAreas && unfilteredSource) {
    for (const id of byArea.keys()) {
      groupFor([]).areas.add(id);
    }
  }
  const membership = new Map<string, { group: Group; fallback?: RoutePaths }>();
  let fallbackNeeded = false;
  for (const trip of trips) {
    if (services && !services.has(trip.service_id)) {
      continue;
    }
    const { route_id, shape_id, direction_id } = trip;
    if (groupBy === 'shape' && (!shape_id || !byShape.has(shape_id))) {
      continue;
    }
    const group = groupFor(
      groupBy === 'source'
        ? []
        : groupBy === 'shape'
          ? [shape_id ?? '']
          : groupBy === 'route'
            ? [route_id]
            : [route_id, String(direction_id ?? 'unspecified')],
    );
    const paths = group.routes.get(route_id) ?? {
      shapeIds: new Set<string>(),
      sequences: new Map<string, Position[]>(),
    };
    group.routes.set(route_id, paths);
    if (shape_id && byShape.has(shape_id)) {
      paths.shapeIds.add(shape_id);
      group.shapes.add(shape_id);
    }
    const fallback = needRoutes && !(shape_id && byShape.has(shape_id));
    if (fallback) {
      fallbackNeeded = true;
    }
    if (((needStops || needAreas) && !unfilteredSource) || fallback) {
      membership.set(trip.trip_id, {
        group,
        ...(fallback && { fallback: paths }),
      });
    }
  }
  const points =
    needStops || fallbackNeeded ? (await gtfs.geojson.stops()).features : [];
  const byStop = new Map(points.map((f) => [f.properties.stop_id, f]));
  for (const p of points) {
    for (const r of p.properties.routes) {
      if (!props.has(r.route_id)) {
        props.set(r.route_id, r);
      }
    }
  }
  // Source-wide unfiltered points already carry serving-route membership.
  if (unfilteredSource && needStops) {
    for (const p of points) {
      if (p.properties.routes.length) {
        groupFor([]).stops.add(p.properties.stop_id);
      }
    }
  }
  if (
    fallbackNeeded ||
    ((needStops || needAreas) && !unfilteredSource && membership.size)
  ) {
    let previous: string | undefined,
      sequence: Position[] = [],
      paths: RoutePaths | undefined;
    const flush = () => {
      if (paths && sequence.length >= 2) {
        paths.sequences.set(JSON.stringify(sequence), sequence);
      }
    };
    for await (const row of gtfs.schedule.stopTimes
      .select('trip_id', 'stop_id', 'location_id')
      .orderBy([{ field: 'trip_id' }, { field: 'stop_sequence' }])
      .stream()) {
      if (row.trip_id !== previous) {
        flush();
        sequence = [];
        previous = row.trip_id;
        paths = membership.get(previous)?.fallback;
      }
      if (needAreas && !unfilteredSource && row.location_id) {
        membership.get(row.trip_id)?.group.areas.add(row.location_id);
      }
      if (!row.stop_id) {
        flush();
        sequence = [];
        continue;
      }
      if (needStops && !unfilteredSource) {
        membership.get(row.trip_id)?.group.stops.add(row.stop_id);
      }
      if (paths) {
        const p = byStop.get(row.stop_id);
        if (p) {
          sequence.push(p.geometry.coordinates);
        } else {
          flush();
          sequence = [];
        }
      }
    }
    flush();
  }
  for (const group of groups.values()) {
    const lines: Feature<LineString | MultiLineString>[] = [];
    if (needRoutes) {
      for (const [routeId, paths] of group.routes) {
        const segments = uniqueSegments([
          ...Array.from(paths.shapeIds, (id) => byShape.get(id))
            .filter((shape) => shape !== undefined)
            .map((shape) => shape.geometry.coordinates),
          ...paths.sequences.values(),
        ]);
        if (!segments.length) {
          continue;
        }
        const properties = {
          ...props.get(routeId),
          source_id: sourceId,
          route_id: routeId,
          ...(groupBy === 'shape' && { shape_id: group.ids[0] }),
          ...(groupBy === 'route-direction' && {
            direction_id:
              group.ids[1] === 'unspecified' ? null : Number(group.ids[1]),
          }),
        };
        lines.push(multiLineString(segments, properties));
      }
    }
    yield {
      ids: group.ids,
      lines,
      areas: Array.from(group.areas, (id) => byArea.get(id)).filter(
        (area) => area !== undefined,
      ),
      points: Array.from(group.stops, (id) => byStop.get(id)).filter(
        (f) => f !== undefined,
      ),
      shapes: Array.from(group.shapes, (id) => byShape.get(id)).filter(
        (shape) => shape !== undefined,
      ),
    };
  }
}
export interface GroupGeometry {
  ids: string[];
  areas: Feature<Polygon | MultiPolygon>[];
  lines: Feature<LineString | MultiLineString>[];
  shapes: Feature<LineString, GtfsShapeGeoJSONProperties>[];
  points: Feature<Point, GtfsStopGeoJSONProperties>[];
}
