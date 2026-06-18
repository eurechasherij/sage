// Curated capability → package map. Seeds the common cases so a coding agent
// reliably connects "client-side data fetching" to an installed `swr` and
// "feature flag override" to `laravel/pennant`. Deliberately small and editable;
// it is the highest-leverage piece, so it is config, not buried logic (design-001).
// Ownership/growth of this list is an open question — keep it curated, not auto-grown.

export interface Alias {
  /** lowercase substrings that, if present in a capability string, fire this alias */
  match: string[];
  npm?: string[];
  composer?: string[];
}

export const DEFAULT_ALIASES: Alias[] = [
  {
    match: ["data fetching", "fetch", "polling", "cache request", "swr", "react query", "remote data"],
    npm: ["swr", "@tanstack/react-query", "react-query"],
  },
  {
    match: ["state management", "global state", "store", "shared state"],
    npm: ["zustand", "jotai", "redux", "@reduxjs/toolkit"],
    composer: [],
  },
  {
    match: ["date", "time", "datetime", "format date", "timezone"],
    npm: ["dayjs", "date-fns", "luxon"],
    composer: ["nesbot/carbon"],
  },
  {
    match: ["decimal", "money", "currency", "precise math", "big number", "rounding"],
    npm: ["decimal.js", "big.js", "dinero.js"],
    composer: ["brick/math", "moneyphp/money"],
  },
  {
    match: ["validation", "schema", "validate input", "parse input"],
    npm: ["zod", "yup", "joi"],
    composer: ["respect/validation"],
  },
  {
    match: ["feature flag", "feature toggle", "beta user", "rollout", "gate feature"],
    npm: ["@openfeature/server-sdk", "launchdarkly-node-server-sdk"],
    composer: ["laravel/pennant"],
  },
  {
    match: ["http client", "api request", "rest call"],
    npm: ["axios", "ky", "got"],
    composer: ["guzzlehttp/guzzle"],
  },
];
