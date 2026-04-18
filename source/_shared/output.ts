import process from "node:process";
import { ListenHubError } from "@marswave/listenhub-sdk";

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printDetail(
  label: string,
  rows: Array<[string, string | number | undefined]>,
): void {
  console.log(`\u2713 ${label}\n`);
  for (const [key, value] of rows) {
    if (value !== undefined) {
      console.log(`  ${key.padEnd(10)} ${String(value)}`);
    }
  }
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  console.log("  " + headers.map((h, i) => h.padEnd(widths[i]!)).join("  "));
  for (const row of rows) {
    console.log("  " + row.map((c, i) => c.padEnd(widths[i]!)).join("  "));
  }
}

export class CliTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliTimeoutError";
  }
}

export class CliAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliAuthError";
  }
}

export function handleError(error: unknown, json: boolean): never {
  if (json) {
    const message =
      error instanceof ListenHubError
        ? { error: error.message, code: error.code, requestId: error.requestId }
        : {
            error: error instanceof Error ? error.message : String(error),
            code: "UNKNOWN",
          };
    console.error(JSON.stringify(message, null, 2));
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\u2717 Error: ${message}`);
  }

  if (
    error instanceof CliAuthError ||
    (error instanceof ListenHubError && (error.status === 401 || error.status === 403))
  ) {
    process.exit(2); // eslint-disable-line unicorn/no-process-exit
  }

  if (error instanceof CliTimeoutError) {
    process.exit(3); // eslint-disable-line unicorn/no-process-exit
  }

  process.exit(1); // eslint-disable-line unicorn/no-process-exit
}
