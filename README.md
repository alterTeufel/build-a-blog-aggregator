# Gator

Gator is a command-line RSS feed aggregator. You can register users, add feeds, follow feeds, and browse posts collected from them.

## What you need

- Node.js **v22.15.0**
- PostgreSQL **16 or newer**
- npm

## Set up the project

Clone the repository and install its dependencies:

```bash
git clone <your-repository-url>
cd BD-blog-aggregator
npm install
```

Create a PostgreSQL database named `gator`. This project expects PostgreSQL to be available on port `5433`. If your database uses a different port or credentials, adjust the connection URL below to match.

Apply the database migrations:

```bash
npx drizzle-kit migrate
```

Create a file named `~/.gatorconfig.json` in your home directory. Replace the example database URL with your own PostgreSQL connection details:

```json
{
  "db_url": "postgres://username:password@localhost:5433/gator",
  "current_user_name": ""
}
```

Gator updates `current_user_name` when you log in or register.

## Run Gator

Run commands from the project directory with:

```bash
npx tsx src/index.ts <command> [arguments]
```

For example, register a user, then log in as that user:

```bash
npx tsx src/index.ts register alice
npx tsx src/index.ts login alice
```

Other commands include:

```bash
npx tsx src/index.ts users
npx tsx src/index.ts addfeed "Example Blog" "https://example.com/feed.xml"
npx tsx src/index.ts following
npx tsx src/index.ts browse
```

`addfeed` creates a feed and automatically follows it for the logged-in user. Use `follow <feed-url>` to follow a feed that has already been added, and `unfollow <feed-url>` to stop following it.

To continuously collect posts, run:

```bash
npx tsx src/index.ts agg 1m
```

The interval can be changed, for example to `30s` or `5m`. Stop the aggregator with **Ctrl+C**.
