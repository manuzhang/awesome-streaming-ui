const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRepoItem, parseReadmeEntries } = require("./sync-repos-metadata");

test("parses legacy and badge-based GitHub entries", function() {
  const readme = [
    "- [Legacy](https://github.com/example/legacy) [Java] - Legacy description.",
    "- [Current](https://github.com/example/current) <sub>![Rust][language-rust]</sub> - Current description.",
    "- [Archived](https://github.com/example/archived) <sub>![Archived][archived-badge]</sub> <sub>![Java/C][language-java-c]</sub> - Archived description.",
    "- [Website](https://example.com/project) <sub>![Go][language-go]</sub> - Not a GitHub repository."
  ].join("\n");

  assert.deepEqual(parseReadmeEntries(readme), [
    {
      name: "Legacy",
      link: "https://github.com/example/legacy",
      description: "Legacy description.",
      repoRef: { owner: "example", repo: "legacy" },
      isArchived: false
    },
    {
      name: "Current",
      link: "https://github.com/example/current",
      description: "Current description.",
      repoRef: { owner: "example", repo: "current" },
      isArchived: false
    },
    {
      name: "Archived",
      link: "https://github.com/example/archived",
      description: "Archived description.",
      repoRef: { owner: "example", repo: "archived" },
      isArchived: true
    }
  ]);
});

test("reuses archived metadata without fetching GitHub", async function() {
  const entry = {
    name: "Archived project",
    link: "https://github.com/example/archived",
    description: "Updated description.",
    repoRef: { owner: "example", repo: "archived" },
    isArchived: true
  };
  const previousItem = {
    name: "Old name",
    link: entry.link,
    description: "Old description.",
    stars: 10,
    forks: 2,
    lastTag: "v1.0.0",
    lastUpdate: "2024-01-01T00:00:00Z",
    isArchived: false
  };
  let fetchCount = 0;

  const item = await buildRepoItem(entry, previousItem, async function() {
    fetchCount += 1;
    throw new Error("Archived metadata should not be fetched");
  });

  assert.equal(fetchCount, 0);
  assert.deepEqual(item, {
    name: "Archived project",
    link: entry.link,
    description: "Updated description.",
    stars: 10,
    forks: 2,
    lastTag: "v1.0.0",
    lastUpdate: "2024-01-01T00:00:00Z",
    isArchived: true
  });
});
