import type { Command } from "commander";
import { getClient } from "../_shared/client.js";
import { handleError } from "../_shared/output.js";
import {
  type SlidesCreateOptions,
  type SlidesListOptions,
  createSlides,
  listSlides,
} from "./slides.js";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function register(program: Command) {
  const cmd = program.command("slides").description("Slides generation");

  cmd
    .command("create")
    .description("Create a slide deck")
    .option("--query <text>", "Topic text")
    .option("--source-url <url>", "Reference URL (repeatable)", collect, [])
    .option("--source-text <text>", "Reference text (repeatable)", collect, [])
    .option("--lang <lang>", "Language: en, zh, ja (auto-detected if omitted)")
    .option("--speaker <name>", "Speaker name")
    .option("--speaker-id <id>", "Speaker inner ID")
    .option("--no-skip-audio", "Generate audio narration")
    .option("--image-size <size>", "Image size: 2K, 4K", "2K")
    .option("--aspect-ratio <ratio>", "Aspect ratio: 16:9, 9:16, 1:1", "16:9")
    .option("--style <style>", "Visual style")
    .option("--no-wait", "Return immediately without polling")
    .option("--timeout <seconds>", "Polling timeout", Number, 300)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: SlidesCreateOptions) => {
      try {
        const client = await getClient();
        await createSlides(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });

  cmd
    .command("list")
    .description("List slide decks")
    .option("--page <n>", "Page number", Number, 1)
    .option("--page-size <n>", "Items per page", Number, 20)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: SlidesListOptions) => {
      try {
        const client = await getClient();
        await listSlides(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });
}
