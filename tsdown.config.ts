import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/gtfs-to-geojson.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  sourcemap: true,
  minify: false,
  target: false,
  inputOptions: {
    onwarn(warning, warn) {
      if (warning.code === 'SOURCEMAP_BROKEN') return;
      warn(warning);
    },
  },
});
