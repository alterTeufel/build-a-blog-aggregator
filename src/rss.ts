import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
};

export type RSSFeed = {
  title: string;
  link: string;
  description: string;
  items: RSSItem[];
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Feed is missing a valid ${field}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : undefined;
}

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: { "User-Agent": "gator" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ processEntities: false });
  const parsed: unknown = parser.parse(xml);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("rss" in parsed) ||
    typeof parsed.rss !== "object" ||
    parsed.rss === null ||
    !("channel" in parsed.rss) ||
    typeof parsed.rss.channel !== "object" ||
    parsed.rss.channel === null
  ) {
    throw new Error("Feed is missing a channel");
  }

  const channel = parsed.rss.channel as Record<string, unknown>;

  const title = requiredString(channel.title, "channel title");
  const link = requiredString(channel.link, "channel link");
  const description = requiredString(channel.description, "channel description");

  const rawItems = channel.item;
  const items: RSSItem[] = rawItems === undefined
    ? []
    : (Array.isArray(rawItems) ? rawItems : [rawItems])
        .flatMap((rawItem): RSSItem[] => {
          if (typeof rawItem !== "object" || rawItem === null) return [];

          const item = rawItem as Record<string, unknown>;
          const itemTitle = optionalString(item.title);
          const itemLink = optionalString(item.link);
          const itemDescription = optionalString(item.description);
          const pubDate = optionalString(item.pubDate);

          if (!itemTitle || !itemLink || !itemDescription || !pubDate) return [];

          // In the item logic, don't reject an item because pubDate is missing.
          // When creating the parsed item:
          return [{
            title: itemTitle,
            link: itemLink,
            description: itemDescription,
            ...(pubDate ? { pubDate } : {}),
          }];
        });

  return { title, link, description, items };
}
