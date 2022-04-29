import { getShapesAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';
import { geomEach } from '@turf/meta';
import { multiPolygon } from '@turf/helpers';
import polygonClipping from 'polygon-clipping';

import { simplifyGeoJSON } from '../geojson-utils.js';

const linesDissolved = async (config, query) => {
  const lines = await getShapesAsGeoJSON(query);
  const bufferedLines = buffer(lines, config.bufferSizeMeters, { units: 'meters' });
  const geometries = [];

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedLines = simplifyGeoJSON(bufferedLines, config);

  geomEach(simplifiedBufferedLines, geometry => {
    if (geometry.type === 'MultiPolygon') {
      geometries.push(geometry.coordinates);
    }

    if (geometry.type === 'Polygon') {
      geometries.push([geometry.coordinates]);
    }
  });
  const unioned = polygonClipping.union(...geometries);
  const geojson = multiPolygon(unioned);

  // Assign agency_name
  geojson.properties.agency_name = bufferedLines.features[0].properties.agency_name;

  return simplifyGeoJSON(geojson, config);
};

export default linesDissolved;
