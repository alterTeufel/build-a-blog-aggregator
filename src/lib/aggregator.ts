import { fetchFeed } from "../rss.js";
import { getNextFeedToFetch, markFeedFetched } from "./db/queries/feeds.js";
import { createPost } from "./db/queries/posts.js";


export async function scrapeFeeds(): Promise<void> {
  const feed = await getNextFeedToFetch();

  if (!feed) {
    console.log("No feeds to fetch.");
    return;
  }

  console.log(`Fetching feed: ${feed.name} (${feed.url})`);

  const rssFeed = await fetchFeed(feed.url);
  await markFeedFetched(feed.id);

  for (const item of rssFeed.items) {
    const parsedDate = item.pubDate ? new Date(item.pubDate) : null;
    const publishedAt =
      parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

    await createPost(
      item.title,
      item.link,
      item.description || null,
      publishedAt,
      feed.id,
    );
  }
}
