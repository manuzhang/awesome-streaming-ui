#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const DEFAULT_INPUT = "src/assets/repos.json";
const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "awesome-streaming-ui-last-update-backfill"
};

function parseArgs(argv) {
  const options = {
    inputPath: DEFAULT_INPUT,
    concurrency: 8,
    failOnMissing: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      options.inputPath = arg;
      continue;
    }

    if (arg === "--no-fail-on-missing") {
      options.failOnMissing = false;
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

    throw new Error("Unknown argument: " + arg);
  }

  return options;
}

function readRepos(inputPath) {
  const text = fs.readFileSync(inputPath, "utf8");
  const repos = JSON.parse(text);

  if (!Array.isArray(repos)) {
    throw new Error("Expected an array in " + inputPath);
  }

  return repos;
}

function needsLastUpdate(repo) {
  return !repo.lastUpdate || Number.isNaN(Date.parse(repo.lastUpdate));
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

    request.on("error", reject);
    request.end();
  });
}

function fetchLastUpdate(repoRef, token) {
  const url =
    "https://api.github.com/repos/" + repoRef.owner + "/" + repoRef.repo;

  return requestJson(url, token, 5).then(function(payload) {
    if (!payload || !payload.pushed_at) {
      throw new Error("Missing pushed_at for " + repoRef.owner + "/" + repoRef.repo);
    }
    return payload.pushed_at;
  });
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
  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const repos = readRepos(inputPath);
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  const targets = repos
    .map(function(repo, index) {
      const repoRef = parseGitHubRepo(repo.link);
      return {
        index: index,
        name: repo.name,
        repoRef: repoRef
      };
    })
    .filter(function(target) {
      return needsLastUpdate(repos[target.index]);
    });

  if (targets.length === 0) {
    console.log("No missing lastUpdate values in " + options.inputPath);
    return;
  }

  const failures = [];
  console.log(
    "Backfilling lastUpdate for " +
      targets.length +
      " repos in " +
      options.inputPath
  );

  await createWorkQueue(
    targets,
    async function(target) {
      if (!target.repoRef) {
        failures.push(target.name + ": unsupported repo link " + repos[target.index].link);
        return;
      }

      try {
        const lastUpdate = await fetchLastUpdate(target.repoRef, token);
        repos[target.index].lastUpdate = lastUpdate;
        console.log("Filled lastUpdate for " + target.name + " -> " + lastUpdate);
      } catch (error) {
        failures.push(target.name + ": " + error.message);
      }
    },
    options.concurrency
  );

  fs.writeFileSync(inputPath, JSON.stringify(repos, null, 2) + "\n");

  const remaining = repos.filter(needsLastUpdate).length;
  console.log("Remaining missing lastUpdate values: " + remaining);

  if (failures.length > 0) {
    console.error("Backfill failures:");
    failures.forEach(function(message) {
      console.error("- " + message);
    });
  }

  if (options.failOnMissing && remaining > 0) {
    process.exitCode = 1;
  }
}

main().catch(function(error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
