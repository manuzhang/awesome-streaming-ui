const assert = require("node:assert/strict");
const test = require("node:test");

const { parseReadmeEntries } = require("./sync-repos-metadata");

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
      repoRef: { owner: "example", repo: "legacy" }
    },
    {
      name: "Current",
      link: "https://github.com/example/current",
      description: "Current description.",
      repoRef: { owner: "example", repo: "current" }
    },
    {
      name: "Archived",
      link: "https://github.com/example/archived",
      description: "Archived description.",
      repoRef: { owner: "example", repo: "archived" }
    }
  ]);
});
