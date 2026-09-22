import { parseBulkImport } from "../bulk-import";

describe("parseBulkImport", () => {
  it("parses simple titles", () => {
    const result = parseBulkImport("Login page\nSignup flow\nDashboard");
    expect(result).toEqual([
      { title: "Login page" },
      { title: "Signup flow" },
      { title: "Dashboard" },
    ]);
  });

  it("parses JIRA key + title", () => {
    const result = parseBulkImport("TA2-123 Login page\nTA2-456 Signup flow");
    expect(result).toEqual([
      { title: "TA2-123 Login page" },
      { title: "TA2-456 Signup flow" },
    ]);
  });

  it("parses title + Jira URL", () => {
    const result = parseBulkImport("Login page https://talkiatry.atlassian.net/browse/TA2-123");
    expect(result).toEqual([
      { title: "Login page", jiraUrl: "https://talkiatry.atlassian.net/browse/TA2-123" },
    ]);
  });

  it("ignores blank lines", () => {
    const result = parseBulkImport("First\n\n\nSecond\n");
    expect(result).toEqual([{ title: "First" }, { title: "Second" }]);
  });

  it("handles Jira URL on its own line", () => {
    const result = parseBulkImport("https://talkiatry.atlassian.net/browse/TA2-789");
    expect(result).toEqual([
      { title: "TA2-789", jiraUrl: "https://talkiatry.atlassian.net/browse/TA2-789" },
    ]);
  });
});
