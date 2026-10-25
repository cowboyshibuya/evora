// Resource identifiers are public configuration, never credentials.
// Forks should replace this target with resources in their own account.
export const production = {
  branch: "main",
  accountId: "befb236f2cdc7e40ba3bcd4b2c358a69",
  workerName: "evora",
  databaseId: "c62864da-74dd-4621-83f8-ee090f916a19",
  databaseName: "evora",
  bucketName: "evora-documents",
  appUrl: "https://evora.cowboyshibuya.workers.dev",
} as const;
