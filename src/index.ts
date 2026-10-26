import { setUser, readConfig } from "./config.js";
import { createUser, deleteAllUsers, getUserByName, getUsers } from "./lib/db/queries/users.js";
import { fetchFeed } from "./rss.js";
import { createFeed, getFeeds } from "./lib/db/queries/feeds.js";
import type { Feed, User } from "./lib/db/schema.js";
import { createFeedFollow, getFeedFollowsForUser, deleteFeedFollow  } from "./lib/db/queries/feedFollows.js";
import { getFeedByURL } from "./lib/db/queries/feeds.js";
import { scrapeFeeds } from "./lib/aggregator.js";
import { getPostsForUser } from "./lib/db/queries/posts.js";

type CommandHandler = (
  cmdName: string,
   ...args: string[]
) => Promise<void>;

type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

type CommandsRegistry = Record<string, CommandHandler>;


const middlewareLoggedIn = (
  handler: UserCommandHandler,
): CommandHandler => {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const config = readConfig();
    const user = await getUserByName(config.currentUserName);

    if (!user) {
      throw new Error(`User ${config.currentUserName} was not found`);
    }

    await handler(cmdName, user, ...args);
  };
};


async function handlerLogin(
  _cmdName: string,
  ...args: string[]
): Promise<void> {
  const username = args[0];

  if (!username) {
    throw new Error("The login command requires a username");
  }

  const user = await getUserByName(username);

  if (!user) {
    throw new Error(`User "${username}" does not exist`);
  }

  setUser(username);
  console.log(`User set to ${username}`);
}

async function handlerRegister(
  _cmdName: string,
  ...args: string[]
): Promise<void> {
  const username = args[0];

  if (!username) {
    throw new Error("The register command requires a username");
  }

  const existingUser = await getUserByName(username);

  if (existingUser) {
    throw new Error(`User "${username}" already exists`);
  }

  const user = await createUser(username);
  setUser(username);

  console.log(`User "${username}" created`);
  console.log(user);
}

async function handlerReset(): Promise<void> {
  await deleteAllUsers();
  console.log("All users deleted.");
}

async function handlerUsers(): Promise<void> {
  const allUsers = await getUsers();
  const { currentUserName } = readConfig();

  for (const user of allUsers) {
    const current = user.name === currentUserName ? " (current)" : "";
    console.log(`* ${user.name}${current}`);
  }
}

async function handlerAgg(
  _cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new Error("Usage: agg <time_between_reqs>");
  }

  const timeBetweenRequests = parseDuration(args[0]);

  if (timeBetweenRequests <= 0) {
    throw new Error("The interval must be greater than zero.");
  }

  console.log(`Collecting feeds every ${formatDuration(timeBetweenRequests)}`);

  let scraping = false;

  const runScrape = async (): Promise<void> => {
    // Avoid overlapping fetches if a scrape takes longer than the interval.
    if (scraping) {
      console.log("Previous scrape is still running; skipping this interval.");
      return;
    }

    scraping = true;
    try {
      await scrapeFeeds();
    } catch (error) {
      console.error("Feed scrape failed:", error);
    } finally {
      scraping = false;
    }
  };

  await runScrape();

  const interval = setInterval(() => {
    void runScrape();
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}


function printFeed(feed: Feed, user: User): void {
  console.log("Feed created successfully!");
  console.log(`  ID:         ${feed.id}`);
  console.log(`  Created:    ${feed.createdAt}`);
  console.log(`  Updated:    ${feed.updatedAt}`);
  console.log(`  Name:       ${feed.name}`);
  console.log(`  URL:        ${feed.url}`);
  console.log(`  User:       ${user.name}`);
}

async function handlerAddFeed(
  _cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 2) {
    throw new Error("Usage: addfeed <name> <url>");
  }

  /*const config = readConfig();
  const user = await getUserByName(config.currentUserName);

  if (!user) {
    throw new Error(`User ${config.currentUserName} was not found`);
  }*/

  const [name, url] = args;
  const feed = await createFeed(name, url, user.id);
  const follow = await createFeedFollow(user.id, feed.id);

  console.log(`${follow.userName} is now following ${follow.feedName}`);
}

async function handlerFeeds(
  _cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length !== 0) {
    throw new Error("Usage: feeds");
  }

  const allFeeds = await getFeeds();

  for (const { feed, user } of allFeeds) {
    console.log(`* ${feed.name} — ${feed.url} (added by ${user.name})`);
  }
}

async function handlerFollow(
  _cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new Error("Usage: follow <url>");
  }

  /*const { currentUserName } = readConfig();
  const user = await getUserByName(currentUserName);

  if (!user) {
    throw new Error(`User ${currentUserName} was not found`);
  }*/

  const feed = await getFeedByURL(args[0]);

  if (!feed) {
    throw new Error(`Feed with URL ${args[0]} was not found`);
  }

  const result = await createFeedFollow(user.id, feed.id);
  console.log(`${result.userName} is now following ${result.feedName}`);
}

async function handlerFollowing(
  _cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 0) {
    throw new Error("Usage: following");
  }

  /*const { currentUserName } = readConfig();
  const user = await getUserByName(currentUserName);

  if (!user) {
    throw new Error(`User ${currentUserName} was not found`);
  }*/

  const follows = await getFeedFollowsForUser(user.id);

  for (const follow of follows) {
    console.log(`* ${follow.feedName}`);
  }
}

async function handlerUnfollow(
  _cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length !== 1) {
    throw new Error("Usage: unfollow <url>");
  }

  const deleted = await deleteFeedFollow(user.id, args[0]);

  if (!deleted) {
    throw new Error("No follow found for that feed URL and user");
  }

  console.log(`Unfollowed ${args[0]}`);
}

async function handlerBrowse(
  _cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length > 1) {
    throw new Error("Usage: browse [limit]");
  }

  const limit = args.length === 0 ? 2 : Number(args[0]);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Limit must be a positive integer.");
  }

  const results = await getPostsForUser(user.id, limit);

  if (results.length === 0) {
    console.log("No posts found.");
    return;
  }

  for (const { post, feedName } of results) {
    console.log(`* ${post.title}`);
    console.log(`  Feed: ${feedName}`);
    console.log(`  URL: ${post.url}`);
    if (post.publishedAt) {
      console.log(`  Published: ${post.publishedAt.toISOString()}`);
    }
    if (post.description) {
      console.log(`  ${post.description}`);
    }
  }
}


function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^(\d+)(ms|s|m|h)$/);

  if (!match) {
    throw new Error("Invalid duration. Use a value like 500ms, 1s, 1m, or 1h.");
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multiplier: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };

  return amount * multiplier[unit];
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const remainingMs = ms % 1_000;

  if (hours > 0) return `${hours}h${minutes}m${seconds}s`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  if (seconds > 0) return `${seconds}s`;
  return `${remainingMs}ms`;
}

function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
): void {
  registry[cmdName] = handler;
}

async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

async function main(): Promise<void> {
  const commands: CommandsRegistry = {};

  registerCommand(commands, "login", handlerLogin);
  registerCommand(commands, "register", handlerRegister);
  registerCommand(commands, "reset", handlerReset);
  registerCommand(commands, "users", handlerUsers);
  registerCommand(commands, "agg", handlerAgg);
  registerCommand(commands, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(commands, "feeds", handlerFeeds);
  registerCommand(commands, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(commands, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(commands, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(commands, "browse", middlewareLoggedIn(handlerBrowse));

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: Not enough arguments provided.");
    process.exit(1);
  }

  const [cmdName, ...cmdArgs] = args;

  try {
    await runCommand(commands, cmdName, ...cmdArgs);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  process.exit(0);
}

main();
