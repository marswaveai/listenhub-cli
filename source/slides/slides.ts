import type {
  ImageSize,
  Language,
  ListenHubClient,
  SlideAspectRatio,
} from "@marswave/listenhub-sdk";
import { inferLanguage } from "../_shared/language.js";
import { printDetail, printJson, printTable } from "../_shared/output.js";
import { pollUntilDone } from "../_shared/polling.js";
import { buildSources } from "../_shared/sources.js";
import { resolveSpeakers } from "../_shared/speaker-resolver.js";

export type SlidesCreateOptions = {
  query?: string;
  sourceUrl?: string[];
  sourceText?: string[];
  lang?: Language;
  speaker?: string;
  speakerId?: string;
  skipAudio: boolean;
  imageSize: ImageSize;
  aspectRatio: SlideAspectRatio;
  style?: string;
  wait: boolean;
  timeout: number;
  json: boolean;
};

export async function createSlides(
  client: ListenHubClient,
  options: SlidesCreateOptions,
): Promise<void> {
  const lang = options.lang ?? inferLanguage(options.query);
  const speakers = await resolveSpeakers(client, {
    speakerNames: options.speaker ? [options.speaker] : undefined,
    speakerIds: options.speakerId ? [options.speakerId] : undefined,
    language: lang,
    count: 1,
  });

  const size = options.imageSize;
  const { aspectRatio } = options;

  const { episodeId } = await client.createSlides({
    query: options.query,
    sources: buildSources(options.sourceUrl, options.sourceText),
    style: options.style,
    skipAudio: options.skipAudio,
    imageConfig: { size, aspectRatio },
    template: {
      type: "storybook",
      mode: "slides",
      speakers,
      language: lang,
      style: options.style,
      size,
      aspectRatio,
    },
  });

  if (!options.wait) {
    if (options.json) {
      printJson({ episodeId });
    } else {
      console.log(`\u2713 Slides submitted: ${episodeId}`);
    }

    return;
  }

  const detail = await pollUntilDone(client, episodeId, {
    timeout: options.timeout,
    label: "Creating slides",
    json: options.json,
  });

  if (options.json) {
    printJson(detail);
  } else {
    printDetail("Slides created", [
      ["ID:", detail.id],
      ["Title:", detail.topicDetail.title.data],
      ["Status:", detail.processStatus],
    ]);
  }
}

export type SlidesListOptions = {
  page: number;
  pageSize: number;
  json: boolean;
};

export async function listSlides(
  client: ListenHubClient,
  options: SlidesListOptions,
): Promise<void> {
  const { items } = await client.listSlides({
    page: options.page,
    pageSize: options.pageSize,
  });

  if (options.json) {
    printJson(items);
    return;
  }

  const headers = ["ID", "Title", "Status", "Created"];
  const rows = items.map((episode) => [
    episode.id,
    episode.title,
    episode.processStatus,
    new Date(episode.createdAt).toISOString().slice(0, 10),
  ]);
  printTable(headers, rows);
}
