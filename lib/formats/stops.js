import { getStopsAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stops = (config, query) => {
  const geojson = getStopsAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default stops;
