import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/gtfs-to-geojson.ts'],
  outDir: 'dist',
  clean: true,
  platform: 'node',
  target: 'node22.18',
  format: 'esm',
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  nodeProtocol: true,
  failOnWarn: 'ci-only',
  suppressWarnings: [
    // The TypeScript 7.1 declaration API is still experimental.
    'TypeScript Go is experimental. Some options will be unavailable.',
  ],
  publint: {
    enabled: 'ci-only',
    level: 'error',
  },
  attw: {
    enabled: 'ci-only',
    profile: 'esm-only',
    level: 'error',
  },
});
