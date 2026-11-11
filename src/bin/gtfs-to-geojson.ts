#!/usr/bin/env node
import { formatGtfsError, isGtfsError } from 'gtfs';
import { run } from '../cli/run.ts';

try {
  await run(process.argv.slice(2));
} catch (error) {
  console.error(
    isGtfsError(error)
      ? formatGtfsError(error, { audience: 'user' })
      : error instanceof Error
        ? error.message
        : String(error),
  );
  process.exitCode = 1;
}
