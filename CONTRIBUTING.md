# Contributing

Install Node.js 22.18+ (22.x) or 24+ and the pnpm version in package.json. Run `pnpm install`, then `pnpm test`. Use `pnpm run build-watch` while editing the CLI or library.

Before opening a pull request, run `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck` and `pnpm run test:release`. The release smoke test unpacks the npm tarball and runs its CLI against the Caltrain fixture. It requires tar and the integration suite uses unzip.

To refresh the checked-in examples, run `pnpm run examples`. The fixture is the historical Caltrain feed used by node-GTFS. Keep example outputs reproducible from that fixture.
