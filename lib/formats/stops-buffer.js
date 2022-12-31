import { getStopsAsGeoJSON } from 'gtfs';
import buffer from '@turf/buffer';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stopsBuffer = (config, query) => {
  const stops = getStopsAsGeoJSON(query);

  const geojson = buffer(stops, config.bufferSizeMeters, { units: 'meters' });

  return simplifyGeoJSON(geojson, config);
};

export default stopsBuffer;
