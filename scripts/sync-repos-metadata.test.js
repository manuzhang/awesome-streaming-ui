const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildRepoItem,
  parseReadmeEntries,
  reusePreviousItem
} = require("./sync-repos-metadata");

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

test("fetches metadata once for an unseen archived entry", async function() {
  const entry = {
    name: "New archived project",
    link: "https://github.com/example/new-archived",
    description: "Archived description.",
    repoRef: { owner: "example", repo: "new-archived" },
    isArchived: true
  };
  let fetchCount = 0;

  const item = await buildRepoItem(entry, null, async function() {
    fetchCount += 1;
    return {
      stars: 20,
      forks: 4,
      lastTag: "v2.0.0",
      lastUpdate: "2025-01-01T00:00:00Z",
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: true,
      isArchived: false
    };
  });

  assert.equal(fetchCount, 1);
  assert.deepEqual(item, {
    name: entry.name,
    link: entry.link,
    description: entry.description,
    stars: 20,
    forks: 4,
    lastTag: "v2.0.0",
    lastUpdate: "2025-01-01T00:00:00Z",
    repositoryLookupSucceeded: true,
    releaseLookupSucceeded: true,
    isArchived: true
  });
});

test("refreshes an archived entry when stored metadata is incomplete", async function() {
  const entry = {
    name: "Archived project",
    link: "https://github.com/example/archived",
    description: "Archived description.",
    repoRef: { owner: "example", repo: "archived" },
    isArchived: true
  };
  const previousItem = {
    name: entry.name,
    link: entry.link,
    description: entry.description,
    stars: null,
    forks: null,
    lastTag: null,
    lastUpdate: null,
    isArchived: true
  };
  let fetchCount = 0;

  const item = await buildRepoItem(entry, previousItem, async function() {
    fetchCount += 1;
    return {
      stars: 20,
      forks: 4,
      lastTag: null,
      lastUpdate: "2025-01-01T00:00:00Z",
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: true,
      isArchived: true
    };
  });

  assert.equal(fetchCount, 1);
  assert.equal(item.lastUpdate, "2025-01-01T00:00:00Z");
});

test("uses the README archive status for active entries", async function() {
  const entry = {
    name: "Active project",
    link: "https://github.com/example/active",
    description: "Active description.",
    repoRef: { owner: "example", repo: "active" },
    isArchived: false
  };

  const item = await buildRepoItem(entry, null, async function() {
    return {
      stars: 30,
      forks: 6,
      lastTag: "v3.0.0",
      lastUpdate: "2026-01-01T00:00:00Z",
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: true,
      isArchived: true
    };
  });

  assert.equal(item.isArchived, false);
});

test("retries a failed archived release lookup", async function() {
  const entry = {
    name: "Archived project",
    link: "https://github.com/example/archived",
    description: "Archived description.",
    repoRef: { owner: "example", repo: "archived" },
    isArchived: true
  };
  let fetchCount = 0;

  const failedItem = await buildRepoItem(entry, null, async function() {
    fetchCount += 1;
    return {
      stars: 20,
      forks: 4,
      lastTag: null,
      lastUpdate: "2025-01-01T00:00:00Z",
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: false,
      isArchived: true
    };
  });
  const completeItem = await buildRepoItem(entry, failedItem, async function() {
    fetchCount += 1;
    return {
      stars: 20,
      forks: 4,
      lastTag: null,
      lastUpdate: "2025-01-01T00:00:00Z",
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: true,
      isArchived: true
    };
  });
  await buildRepoItem(entry, completeItem, async function() {
    fetchCount += 1;
    throw new Error("Successful empty release lookup should be reused");
  });

  assert.equal(fetchCount, 2);
});

test("reuses an archived entry with a valid null push timestamp", async function() {
  const entry = {
    name: "Empty archived project",
    link: "https://github.com/example/empty-archived",
    description: "Archived repository without commits.",
    repoRef: { owner: "example", repo: "empty-archived" },
    isArchived: true
  };
  let fetchCount = 0;

  const completeItem = await buildRepoItem(entry, null, async function() {
    fetchCount += 1;
    return {
      stars: 0,
      forks: 0,
      lastTag: null,
      lastUpdate: null,
      repositoryLookupSucceeded: true,
      releaseLookupSucceeded: true,
      isArchived: true
    };
  });
  const reusedItem = await buildRepoItem(entry, completeItem, async function() {
    fetchCount += 1;
    throw new Error("Successful null push timestamp should be reused");
  });

  assert.equal(fetchCount, 1);
  assert.equal(reusedItem.lastUpdate, null);
  assert.equal(reusedItem.repositoryLookupSucceeded, true);
});

test("applies the README archive status when reusing metadata after a failure", function() {
  const entry = {
    name: "Active project",
    link: "https://github.com/example/project",
    description: "Active description.",
    isArchived: false
  };
  const previousItem = {
    name: "Archived project",
    link: entry.link,
    description: "Archived description.",
    stars: 20,
    forks: 4,
    lastTag: "v2.0.0",
    lastUpdate: "2025-01-01T00:00:00Z",
    releaseLookupSucceeded: true,
    isArchived: true
  };

  assert.equal(reusePreviousItem(entry, previousItem).isArchived, false);
});
