import { desc, eq, sql } from "drizzle-orm";
import { db } from "../index.js";
import { feedFollows, feeds, posts } from "../schema.js";

export async function createPost(
  title: string,
  url: string,
  description: string | null,
  publishedAt: Date | null,
  feedId: string,
): Promise<void> {
  await db
    .insert(posts)
    .values({ title, url, description, publishedAt, feedId })
    .onConflictDoNothing({ target: posts.url });
}

export async function getPostsForUser(userId: string, limit: number) {
  return db
    .select({
      post: posts,
      feedName: feeds.name,
    })
    .from(posts)
    .innerJoin(feeds, eq(posts.feedId, feeds.id))
    .innerJoin(feedFollows, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId))
    .orderBy(sql`${posts.publishedAt} DESC NULLS LAST`, desc(posts.createdAt))
    .limit(limit);
}
