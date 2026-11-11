import { featureCollection, lineString, multiLineString } from '@turf/helpers';
import { groupBy, maxBy } from 'lodash-es';
import toposort from 'toposort';
import type { Gtfs, Trips, GtfsStopGeoJSONProperties } from 'gtfs';
import type { Position, Feature, FeatureCollection, Point } from 'geojson';
import type { Config } from '../types/global_interfaces.js';

export type GeometryInput = {
  scope: string;
  stops: () => FeatureCollection<Point, GtfsStopGeoJSONProperties>;
  lines: () => FeatureCollection | null;
};

type Trip = Pick<
  Trips,
  'route_id' | 'direction_id' | 'shape_id' | 'trip_id' | 'service_id'
>;

// Keep only the first occurrence of each segment, including reversed segments.
function routeCoordinates(shapes: Position[][]) {
  const segments = new Set<string>();
  const lines: Position[][] = [];
  for (const points of shapes) {
    let line: Position[] = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      const key = [a.join(','), b.join(',')].sort().join('|');
      if (segments.has(key)) {
        line = [];
        continue;
      }
      segments.add(key);
      if (!line.length) {
        line.push(a);
        lines.push(line);
      }
      line.push(b);
    }
  }
  return lines;
}

export async function readFeed(gtfs: Gtfs, config: Config) {
  const stops = await gtfs.geojson.stops();
  const points = new Map(stops.features.map((f) => [f.properties.stop_id, f]));
  const shapes = await gtfs.geojson.shapes();
  const byShape = new Map(
    shapes.features.map((f) => [f.properties.shape_id, f]),
  );
  const routes = await gtfs.schedule.routes.all();
  let trips = await gtfs.schedule.trips
    .select('trip_id', 'route_id', 'direction_id', 'shape_id', 'service_id')
    .all();
  if (config.startDate || config.endDate) {
    const calendars = await gtfs.schedule.calendar.all();
    const services = new Set(
      calendars
        .filter(
          (c) =>
            (!config.startDate || c.end_date >= Number(config.startDate)) &&
            (!config.endDate || c.start_date <= Number(config.endDate)),
        )
        .map((c) => c.service_id),
    );
    trips = trips.filter((t) => services.has(t.service_id));
  }

  const stopIds = new Map<string, string[]>();
  for await (const row of gtfs.schedule.stopTimes
    .select('trip_id', 'stop_id')
    .orderBy([{ field: 'trip_id' }, { field: 'stop_sequence' }])
    .stream()) {
    if (!row.stop_id) continue;
    const ids = stopIds.get(row.trip_id) ?? [];
    ids.push(row.stop_id);
    stopIds.set(row.trip_id, ids);
  }
  const routeById = new Map(routes.map((r) => [r.route_id, r]));
  const properties = new Map(
    shapes.features.flatMap((f) =>
      f.properties.routes.map((r) => [r.route_id, r] as const),
    ),
  );

  function getStops(
    selected: Trip[],
  ): FeatureCollection<Point, GtfsStopGeoJSONProperties> {
    const ids = new Set<string>();
    for (const trip of selected) {
      for (const id of stopIds.get(trip.trip_id) ?? []) ids.add(id);
    }
    return featureCollection(
      Array.from(ids).flatMap((id) => {
        const point = points.get(id);
        return point ? [point] : [];
      }),
    );
  }

  const attributesByRoute = new Map(
    (await gtfs.gtfsPlus.routeAttributes.all()).map((r) => [r.route_id, r]),
  );

  function getLines(
    selected: Trip[],
    shapeId?: string,
  ): FeatureCollection | null {
    const features: Feature[] = [];
    for (const [routeId, routeTrips] of Object.entries(
      groupBy(selected, 'route_id'),
    )) {
      const shapeIds = new Set(routeTrips.map((t) => t.shape_id));
      const coordinates = [...shapeIds].flatMap((id) => {
        const shape = id && byShape.get(id);
        return shape ? [shape.geometry.coordinates] : [];
      });
      if (coordinates.length) {
        features.push(
          multiLineString(routeCoordinates(coordinates), {
            ...properties.get(routeId),
            ...(shapeId && { shape_id: shapeId }),
          }),
        );
      } else if (!shapeId) {
        const sequences = routeTrips.map((t) => stopIds.get(t.trip_id) ?? []);
        const edges: [string, string][] = sequences.flatMap((ids) =>
          ids.slice(1).map((id, i): [string, string] => [ids[i], id]),
        );
        let ordered: string[];
        try {
          ordered = toposort(edges);
        } catch {
          ordered = maxBy(sequences, (ids) => ids.length) ?? [];
        }
        const coords = ordered.flatMap((id) => {
          const point = points.get(id);
          return point ? [point.geometry.coordinates] : [];
        });
        if (coords.length >= 2) {
          const routeAttributes = attributesByRoute.get(routeId);
          features.push(
            lineString(coords, {
              route: routeById.get(routeId),
              routeAttributes: routeAttributes ? [routeAttributes] : [],
            }),
          );
        }
      }
    }
    return features.length ? featureCollection(features) : null;
  }

  return { routes, trips, shapeIds: [...byShape.keys()], getStops, getLines };
}
