import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

function validateConfig(rawConfig: unknown): Config {
  if (typeof rawConfig !== "object" || rawConfig === null) {
    throw new Error("Config must contain a JSON object");
  }

  const raw = rawConfig as Record<string, unknown>;

  if (typeof raw.db_url !== "string") {
    throw new Error("Config is missing a valid db_url");
  }

  if (
    raw.current_user_name !== undefined &&
    typeof raw.current_user_name !== "string"
  ) {
    throw new Error("current_user_name must be a string");
  }

  return {
    dbUrl: raw.db_url,
    ...(typeof raw.current_user_name === "string"
      ? { currentUserName: raw.current_user_name }
      : {}),
  };
}

export function readConfig(): Config {
  const contents = fs.readFileSync(getConfigFilePath(), "utf-8");
  return validateConfig(JSON.parse(contents));
}

function writeConfig(cfg: Config): void {
  const savedConfig = {
    db_url: cfg.dbUrl,
    ...(cfg.currentUserName !== undefined
      ? { current_user_name: cfg.currentUserName }
      : {}),
  };

  fs.writeFileSync(
    getConfigFilePath(),
    `${JSON.stringify(savedConfig, null, 2)}\n`,
    "utf-8",
  );
}

export function setUser(userName: string): void {
  const cfg = readConfig();
  cfg.currentUserName = userName;
  writeConfig(cfg);
}
