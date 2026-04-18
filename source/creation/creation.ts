import type { ListenHubClient } from "@marswave/listenhub-sdk";
import { printDetail, printJson } from "../_shared/output.js";

export async function getCreation(
  client: ListenHubClient,
  episodeId: string,
  json: boolean,
): Promise<void> {
  const detail = await client.getCreation(episodeId);

  if (json) {
    printJson(detail);
    return;
  }

  printDetail("Creation details", [
    ["ID:", detail.id],
    ["Type:", detail.generationType],
    ["Status:", detail.processStatus],
    ["Language:", detail.language],
    ["Created:", new Date(detail.createdAt).toISOString()],
  ]);
}

export async function deleteCreations(
  client: ListenHubClient,
  ids: string[],
  json: boolean,
): Promise<void> {
  await client.deleteCreations({ ids });

  if (json) {
    printJson({ deleted: ids });
  } else {
    console.log(`\u2713 Deleted ${String(ids.length)} creation(s)`);
  }
}
