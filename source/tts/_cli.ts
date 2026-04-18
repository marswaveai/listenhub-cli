import type { Command } from "commander";
import { getClient } from "../_shared/client.js";
import { handleError } from "../_shared/output.js";
import { type TtsCreateOptions, type TtsListOptions, createTts, listTts } from "./tts.js";

export function register(program: Command) {
  const cmd = program.command("tts").description("Text-to-speech generation");

  cmd
    .command("create")
    .description("Create a TTS audio")
    .option("--text <text>", "Text to convert to speech")
    .option("--source-url <url>", "Reference URL (repeatable)", collect, [])
    .option("--source-text <text>", "Reference text (repeatable)", collect, [])
    .option("--mode <mode>", "Generation mode: smart, direct", "smart")
    .option("--lang <lang>", "Language: en, zh, ja (auto-detected if omitted)")
    .option("--speaker <name>", "Speaker name")
    .option("--speaker-id <id>", "Speaker inner ID")
    .option("--no-wait", "Return immediately without polling")
    .option("--timeout <seconds>", "Polling timeout", Number, 300)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: TtsCreateOptions) => {
      try {
        const client = await getClient();
        await createTts(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });

  cmd
    .command("list")
    .description("List TTS episodes")
    .option("--page <n>", "Page number", Number, 1)
    .option("--page-size <n>", "Items per page", Number, 20)
    .option("-j, --json", "Output JSON", false)
    .action(async (options: TtsListOptions) => {
      try {
        const client = await getClient();
        await listTts(client, options);
      } catch (error) {
        handleError(error, options.json);
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
