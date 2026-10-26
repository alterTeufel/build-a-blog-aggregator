import { and, eq } from "drizzle-orm";
import { db } from "../index.js";
import { feedFollows, feeds, users } from "../schema.js";

export async function createFeedFollow(userId: string, feedId: string) {
  const [newFollow] = await db
    .insert(feedFollows)
    .values({ userId, feedId })
    .returning();

  if (!newFollow) {
    throw new Error("Failed to create feed follow");
  }

  const [result] = await db
    .select({
      feedFollow: feedFollows,
      userName: users.name,
      feedName: feeds.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.id, newFollow.id));

  if (!result) {
    throw new Error("Created follow could not be retrieved");
  }

  return result;
}

export async function getFeedFollowsForUser(userId: string) {
  return db
    .select({
      feedFollow: feedFollows,
      userName: users.name,
      feedName: feeds.name,
    })
    .from(feedFollows)
    .innerJoin(users, eq(feedFollows.userId, users.id))
    .innerJoin(feeds, eq(feedFollows.feedId, feeds.id))
    .where(eq(feedFollows.userId, userId));
}

export async function deleteFeedFollow(
  userId: string,
  feedUrl: string,
): Promise<boolean> {
  const [feed] = await db
    .select({id: feeds.id})
    .from(feeds)
    .where(eq(feeds.url, feedUrl));
  
  if (!feed) {
    return false;
  }

  const deleted = await db
    .delete(feedFollows)
    .where(
      and(
        eq(feedFollows.userId, userId),
        eq(feedFollows.feedId, feed.id)
      ),
    )
    .returning({ id: feedFollows.id});
  
  return deleted.length > 0;
}