import { ValueTransformer } from 'typeorm';

/**
 * Postgres returns `bigint` columns as strings to avoid precision loss.
 * Counts stay far below Number.MAX_SAFE_INTEGER, so map them to numbers.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};
