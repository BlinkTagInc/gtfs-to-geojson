import { getStopsAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';

import { simplifyGeoJSON, unionGeojson } from '../geojson-utils.js';

const stopsDissolved = async (config, query) => {
  const stops = await getStopsAsGeoJSON(query);
  const bufferedStops = buffer(stops, config.bufferSizeMeters, {
    units: 'meters',
  });

  // Simplify geoJSON buffers before unioning
  const simplifiedBufferedStops = simplifyGeoJSON(bufferedStops, config);
  const geojson = unionGeojson(simplifiedBufferedStops, config);

  // Assign agency_name
  geojson.properties.agency_name =
    bufferedStops.features[0].properties.agency_name;

  return simplifyGeoJSON(geojson, config);
};

export default stopsDissolved;
