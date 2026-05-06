#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const DEFAULT_OUTPUT = "src/assets/repos.json";
const README_API_URL =
  "https://api.github.com/repos/manuzhang/awesome-streaming/contents/README.md?ref=master";
const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "awesome-streaming-ui-metadata-sync",
  "X-GitHub-Api-Version": "2022-11-28"
};

function parseArgs(argv) {
  const options = {
    outputPath: DEFAULT_OUTPUT,
    concurrency: 6,
    limit: 0
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      options.outputPath = arg;
      continue;
    }

    if (arg === "--concurrency") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("Invalid --concurrency value");
      }
      options.concurrency = value;
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Invalid --limit value");
      }
      options.limit = value;
      index += 1;
      continue;
    }

    throw new Error("Unknown argument: " + arg);
  }

  return options;
}

function parseGitHubRepo(link) {
  if (!link) {
    return null;
  }

  let url;
  try {
    url = new URL(link);
  } catch (error) {
    return null;
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const segments = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.length < 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1].replace(/\.git$/, "")
  };
}

function repoKey(repoRef) {
  return (repoRef.owner + "/" + repoRef.repo).toLowerCase();
}

function readExistingRepos(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return [];
  }

  const text = fs.readFileSync(outputPath, "utf8");
  const repos = JSON.parse(text);
  return Array.isArray(repos) ? repos : [];
}

function requestJson(url, token, redirectsLeft) {
  return new Promise(function(resolve, reject) {
    const parsedUrl = new URL(url);
    const headers = Object.assign({}, API_HEADERS);
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    const request = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: headers
      },
      function(response) {
        const statusCode = response.statusCode || 0;

        if (
          redirectsLeft > 0 &&
          response.headers.location &&
          [301, 302, 307, 308].indexOf(statusCode) !== -1
        ) {
          response.resume();
          resolve(requestJson(response.headers.location, token, redirectsLeft - 1));
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", function(chunk) {
          body += chunk;
        });
        response.on("end", function() {
          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new Error(
                "GitHub API request failed with status " +
                  statusCode +
                  " for " +
                  url +
                  ": " +
                  body
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(
              new Error("Failed to parse GitHub API response for " + url + ": " + error.message)
            );
          }
        });
      }
    );

    request.setTimeout(30000, function() {
      request.destroy(new Error("Request timed out for " + url));
    });

    request.on("error", reject);
    request.end();
  });
}

async function requestJsonWithRetry(url, token, attempts) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestJson(url, token, 5);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
      console.warn("Retrying " + url + " after attempt " + attempt + ": " + error.message);
      await wait(2000 * attempt);
    }
  }

  throw lastError;
}

function wait(durationMs) {
  return new Promise(function(resolve) {
    setTimeout(resolve, durationMs);
  });
}

async function fetchAwesomeReadme(token) {
  const payload = await requestJsonWithRetry(README_API_URL, token, 3);

  if (!payload || !payload.content) {
    throw new Error("README payload did not include content");
  }

  const encoding = payload.encoding || "base64";
  return Buffer.from(payload.content, encoding).toString("utf8");
}

function collectReadmeBullets(readmeText) {
  const lines = readmeText.split(/\r?\n/);
  const bullets = [];
  let current = null;

  lines.forEach(function(line) {
    const trimmed = line.trim();

    if (/^-\s+/.test(trimmed)) {
      if (current) {
        bullets.push(current);
      }
      current = trimmed;
      return;
    }

    if (!current) {
      return;
    }

    if (!trimmed || /^(##|###)\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      bullets.push(current);
      current = null;
      return;
    }

    current += " " + trimmed;
  });

  if (current) {
    bullets.push(current);
  }

  return bullets;
}

function parseReadmeEntries(readmeText) {
  const bullets = collectReadmeBullets(readmeText);
  const entries = [];

  bullets.forEach(function(bullet) {
    const match = bullet.match(
      /^-\s+\[(.+?)\]\s*\((https?:\/\/[^)]+)\)(?:\s+\[[^\]]*])?\s*-\s*(.+)$/
    );

    if (!match) {
      return;
    }

    const link = match[2].trim();
    const repoRef = parseGitHubRepo(link);
    if (!repoRef) {
      return;
    }

    entries.push({
      name: match[1].trim(),
      link: link,
      description: match[3].trim(),
      repoRef: repoRef
    });
  });

  return entries;
}

async function fetchRepoMetadata(repoRef, token) {
  const repoUrl =
    "https://api.github.com/repos/" + repoRef.owner + "/" + repoRef.repo;
  const payload = await requestJsonWithRetry(repoUrl, token, 3);

  const releasesUrl =
    "https://api.github.com/repos/" +
    repoRef.owner +
    "/" +
    repoRef.repo +
    "/releases?per_page=1";

  let lastTag = null;
  try {
    const releases = await requestJsonWithRetry(releasesUrl, token, 2);
    if (
      Array.isArray(releases) &&
      releases.length > 0 &&
      releases[0] &&
      releases[0].tag_name
    ) {
      lastTag = releases[0].tag_name;
    }
  } catch (error) {
    console.warn(
      "Unable to fetch releases for " +
        repoRef.owner +
        "/" +
        repoRef.repo +
        ": " +
        error.message
    );
  }

  return {
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    lastTag: lastTag,
    lastUpdate: payload.pushed_at,
    isArchived: payload.archived
  };
}

function createWorkQueue(items, worker, concurrency) {
  let cursor = 0;

  function runNext() {
    if (cursor >= items.length) {
      return Promise.resolve();
    }

    const item = items[cursor];
    cursor += 1;

    return Promise.resolve(worker(item)).then(runNext);
  }

  const workers = [];
  const workerCount = Math.min(concurrency, items.length);
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(runNext());
  }
  return Promise.all(workers);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const outputPath = path.resolve(process.cwd(), options.outputPath);
  const existingRepos = readExistingRepos(outputPath);
  const existingByRepoKey = new Map();
  existingRepos.forEach(function(repo) {
    const repoRef = parseGitHubRepo(repo.link);
    if (!repoRef) {
      return;
    }
    existingByRepoKey.set(repoKey(repoRef), repo);
  });
  const readmeText = await fetchAwesomeReadme(token);
  let entries = parseReadmeEntries(readmeText);

  if (options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  if (entries.length === 0) {
    throw new Error("No GitHub repo entries were parsed from the upstream README");
  }

  const items = new Array(entries.length);
  const tasks = entries.map(function(entry, index) {
    return {
      entry: entry,
      index: index
    };
  });
  const failures = [];

  console.log("Syncing metadata for " + entries.length + " repos");

  await createWorkQueue(
    tasks,
    async function(task) {
      const entry = task.entry;
      const previousItem = existingByRepoKey.get(repoKey(entry.repoRef)) || null;
      try {
        const metadata = await fetchRepoMetadata(entry.repoRef, token);
        items[task.index] = {
          name: entry.name,
          link: entry.link,
          description: entry.description,
          stars: metadata.stars,
          forks: metadata.forks,
          lastTag: metadata.lastTag || (previousItem && previousItem.lastTag) || null,
          lastUpdate: metadata.lastUpdate,
          isArchived: metadata.isArchived
        };
        console.log("Synced " + entry.name);
      } catch (error) {
        if (previousItem) {
          items[task.index] = Object.assign({}, previousItem, {
            name: entry.name,
            link: entry.link,
            description: entry.description
          });
          console.warn("Fell back to existing metadata for " + entry.name + ": " + error.message);
          return;
        }
        failures.push(entry.name + ": " + error.message);
      }
    },
    options.concurrency
  );

  if (failures.length > 0) {
    console.error("Metadata sync failures:");
    failures.forEach(function(message) {
      console.error("- " + message);
    });
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2) + "\n");
  console.log("Wrote " + items.length + " repos to " + options.outputPath);
}

main().catch(function(error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
