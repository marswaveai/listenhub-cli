import type { Command } from "commander";
import { getClient } from "../_shared/client.js";
import { handleError } from "../_shared/output.js";
import {
  type PodcastCreateOptions,
  type PodcastListOptions,
  createPodcast,
  listPodcasts,
} from "./podcast.js";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function register(program: Command) {
  const cmd = program.command("podcast").description("Podcast generation");

  cmd
    .command("create")
    .description("Create a podcast episode")
    .option("--query <text>", "Topic text")
    .option("--source-url <url>", "Reference URL (repeatable)", collect, [])
    .option("--source-text <text>", "Reference text (repeatable)", collect, [])
    .option("--mode <mode>", "Generation mode: quick, deep, debate", "quick")
    .option("--lang <lang>", "Language: en, zh, ja (auto-detected if omitted)")
    .option("--speaker <name>", "Speaker name (repeatable)", collect, [])
    .option("--speaker-id <id>", "Speaker inner ID (repeatable)", collect, [])
    .option("--no-wait", "Return immediately without polling")
    .option("--timeout <seconds>", "Polling timeout", Number, 300)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: PodcastCreateOptions) => {
      try {
        const client = await getClient();
        await createPodcast(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });

  cmd
    .command("list")
    .description("List podcast episodes")
    .option("--page <n>", "Page number", Number, 1)
    .option("--page-size <n>", "Items per page", Number, 20)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: PodcastListOptions) => {
      try {
        const client = await getClient();
        await listPodcasts(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });
}
