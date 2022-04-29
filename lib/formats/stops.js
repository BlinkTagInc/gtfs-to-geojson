import { getStopsAsGeoJSON } from 'gtfs';

import { simplifyGeoJSON } from '../geojson-utils.js';

const stops = async (config, query) => {
  const geojson = await getStopsAsGeoJSON(query);

  return simplifyGeoJSON(geojson, config);
};

export default stops;
