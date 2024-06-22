import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/gtfs-to-geojson.ts'],
  dts: true,
  clean: true,
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  minify: false,
});
