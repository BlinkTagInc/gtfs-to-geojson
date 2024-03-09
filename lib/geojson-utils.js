import { cloneDeep, flatMap, maxBy, omitBy, size } from 'lodash-es';
import { feature, featureCollection } from '@turf/helpers';
import { featureEach } from '@turf/meta';
import simplify from '@turf/simplify';
import union from '@turf/union';
import {
  getRoutes,
  getShapesAsGeoJSON,
  getStops,
  getStoptimes,
  getTrips,
} from 'gtfs';
import toposort from 'toposort';

function formatHexColor(color) {
  if (color === null || color === undefined) {
    return;
  }

  return `#${color}`;
}

function formatProperties(properties) {
  const formattedProperties = {
    ...cloneDeep(omitBy(properties, (value) => value === null)),
    route_color: formatHexColor(properties.route_color),
    route_text_color: formatHexColor(properties.route_text_color),
  };

  if (properties.routes) {
    formattedProperties.routes = properties.routes.map((route) =>
      formatProperties(route),
    );
  }

  return formattedProperties;
}

const truncateCoordinate = (coordinate, precision) => [
  Math.round(coordinate[0] * 10 ** precision) / 10 ** precision,
  Math.round(coordinate[1] * 10 ** precision) / 10 ** precision,
];

const truncateGeoJSONDecimals = (geojson, config) => {
  featureEach(geojson, (feature) => {
    if (feature.geometry.coordinates) {
      if (feature.geometry.type.toLowerCase() === 'point') {
        feature.geometry.coordinates = truncateCoordinate(
          feature.geometry.coordinates,
          config.coordinatePrecision,
        );
      } else if (feature.geometry.type.toLowerCase() === 'linestring') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(
          (coordinate) =>
            truncateCoordinate(coordinate, config.coordinatePrecision),
        );
      } else if (feature.geometry.type.toLowerCase() === 'polygon') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(
          (line) =>
            line.map((coordinate) =>
              truncateCoordinate(coordinate, config.coordinatePrecision),
            ),
        );
      } else if (feature.geometry.type.toLowerCase() === 'multipolygon') {
        feature.geometry.coordinates = feature.geometry.coordinates.map(
          (polygon) =>
            polygon.map((line) =>
              line.map((coordinate) =>
                truncateCoordinate(coordinate, config.coordinatePrecision),
              ),
            ),
        );
      }
    }
  });

  return geojson;
};

/*
 * Merge any number of geojson objects into one. Only works for `FeatureCollection`.
 */
export function mergeGeojson(...geojsons) {
  return featureCollection(flatMap(geojsons, (geojson) => geojson.features));
}

/*
 * Simplify geojson and truncate decimals to precision specified in config.
 */
export function simplifyGeoJSON(geojson, config) {
  if (config.coordinatePrecision === undefined) {
    return geojson;
  }

  if (geojson.type.toLowerCase() === 'featurecollection') {
    geojson.features = geojson.features.map((feature) =>
      simplifyGeoJSON(feature, config),
    );
    return geojson;
  }

  if (geojson.geometry.type.toLowerCase() === 'multipolygon') {
    return truncateGeoJSONDecimals(geojson, config);
  }

  try {
    const simplifiedGeojson = simplify(geojson, {
      tolerance: 1 / 10 ** config.coordinatePrecision,
      highQuality: true,
    });

    return truncateGeoJSONDecimals(simplifiedGeojson, config);
  } catch {
    config.logWarning('Unable to simplify geojson');

    return truncateGeoJSONDecimals(geojson, config);
  }
}

export function stripNonAgencyProperties(geojson) {
  featureEach(geojson, (feature) => {
    feature.properties = {
      agency_name: feature.properties.agency_name,
    };
  });

  return geojson;
}

export function unionGeojson(geojson, config) {
  let unioned = geojson.features[0].geometry;

  for (const [index, feature] of geojson.features.entries()) {
    config.log(
      `Dissolving feature ${index + 1} of ${geojson.features.length}`,
      index > 0,
    );
    unioned = union(unioned, feature.geometry);
  }

  return unioned;
}

function getOrderedStopIdsForRoute(routeId) {
  const trips = getTrips({ route_id: routeId });

  for (const trip of trips) {
    trip.stoptimes = getStoptimes(
      { trip_id: trip.trip_id },
      [],
      [['stop_sequence', 'ASC']],
    );
  }

  // Try using a directed graph to determine stop order.
  try {
    const stopGraph = [];

    for (const trip of trips) {
      const sortedStopIds = trip.stoptimes.map((stoptime) => stoptime.stop_id);

      for (const [index, stopId] of sortedStopIds.entries()) {
        if (index === sortedStopIds.length - 1) {
          continue;
        }

        stopGraph.push([stopId, sortedStopIds[index + 1]]);
      }
    }

    return toposort(stopGraph);
  } catch {
    // Ignore errors and move to next strategy.
  }

  // Fall back to using the stop order from the trip with the most stoptimes.
  const longestTrip = maxBy(trips, (trip) => size(trip.stoptimes));
  return longestTrip.stoptimes.map((stoptime) => stoptime.stop_id);
}

export function getRouteLinesAsGeoJSON(query) {
  const geojson = getShapesAsGeoJSON(query);

  // Use shapes from shapes.txt if available
  if (geojson.features.length > 0) {
    return geojson;
  }

  // Fall back to using stops if no shapes are available
  if (query.shape_id) {
    throw new Error(
      'No shapes found in shapes.txt, unable to create geoJSON with outputType = shape',
    );
  }

  // Get a single route or all routes depending on query
  const routes = query.route_id
    ? getRoutes({ route_id: query.route_id })
    : getRoutes();

  return featureCollection(
    routes.map((route) => {
      const orderedStopIds = getOrderedStopIdsForRoute(route.route_id);
      const stops = getStops({ stop_id: orderedStopIds }, [
        'stop_id',
        'stop_lat',
        'stop_lon',
      ]);
      const orderedStops = orderedStopIds.map((stopId) =>
        stops.find((stop) => stop.stop_id === stopId),
      );

      return feature(
        {
          type: 'LineString',
          coordinates: orderedStops.map((stop) => [
            stop.stop_lon,
            stop.stop_lat,
          ]),
        },
        formatProperties(route),
      );
    }),
  );
}
