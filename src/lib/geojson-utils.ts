import { flatMap } from 'lodash-es';
import { featureCollection, round } from '@turf/helpers';
import { coordEach, featureEach } from '@turf/meta';
import simplify from '@turf/simplify';
import union from '@turf/union';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import { logWarning } from './log-utils.js';
import type { Config } from '../types/global_interfaces.js';

/*
 * Truncate geojson coordinates to a specific number of decimal places.
 */
function truncateGeoJSONDecimals<T extends Feature | FeatureCollection>(
  geojson: T,
  precision: number,
) {
  coordEach(geojson, (position) => {
    for (let i = 0; i < position.length; i++)
      position[i] = round(position[i], precision);
  });
  return geojson;
}

/*
 * Merge any number of geojson objects into one. Only works for `FeatureCollection`.
 */
export function mergeGeojson(
  ...geojsons: FeatureCollection[]
): FeatureCollection {
  return featureCollection(flatMap(geojsons, (geojson) => geojson.features));
}

/*
 * Simplify geojson and truncate decimals to precision specified in config.
 */
export function simplifyGeoJSON<
  T extends Feature | FeatureCollection | undefined,
>(geojson: T, config: Config): T {
  const precision = config.coordinatePrecision;
  if (!geojson || precision === undefined) return geojson;
  if (geojson.type === 'FeatureCollection') {
    geojson.features = geojson.features.map((f) => simplifyGeoJSON(f, config));
    return geojson;
  }
  if (geojson.geometry.type === 'MultiPolygon')
    return truncateGeoJSONDecimals(geojson, precision);
  try {
    return truncateGeoJSONDecimals(
      simplify(geojson, {
        tolerance: 1 / 10 ** precision,
        highQuality: true,
      }),
      precision,
    );
  } catch {
    logWarning(config)('Unable to simplify geojson');
    return truncateGeoJSONDecimals(geojson, precision);
  }
}

export function stripNonAgencyProperties(geojson: Feature | FeatureCollection) {
  featureEach(geojson, (feature) => {
    feature.properties = {
      agency_name: feature.properties?.agency_name,
    };
  });

  return geojson;
}

export function unionGeojson(
  geojson: FeatureCollection<Polygon | MultiPolygon>,
  config: Config,
) {
  if (geojson.features.length === 1) {
    return geojson;
  }

  try {
    return union(geojson) ?? geojson;
  } catch {
    logWarning(config)('Unable to dissolve geojson');
    return geojson;
  }
}
