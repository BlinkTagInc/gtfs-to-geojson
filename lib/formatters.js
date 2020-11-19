exports.msToSeconds = ms => {
  return Math.round(ms / 1000);
};

exports.getRouteName = route => {
  if (route.route_short_name !== '' && route.route_short_name !== undefined) {
    return route.route_short_name;
  }

  return route.route_long_name;
};
