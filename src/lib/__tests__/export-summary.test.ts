import { generateExportMarkdown } from "../export-summary";
import { Session } from "../types";

describe("generateExportMarkdown", () => {
  it("generates markdown with ticket names and votes", () => {
    const session: Session = {
      id: "test",
      name: "Sprint 42",
      hostId: "host",
      createdAt: new Date().toISOString(),
      activeTicketId: null,
      jiraConnected: false,
      participants: [
        { id: "a", name: "Alice", isHost: true, isSpectator: false, isConnected: true },
        { id: "b", name: "Bob", isHost: false, isSpectator: false, isConnected: true },
      ],
      tickets: [
        {
          id: "t1",
          title: "Login flow",
          jiraKey: "TA2-123",
          status: "revealed",
          votes: { a: 5, b: 8 },
          comments: [{ id: "c1", participantName: "Alice", text: "Complex auth logic", timestamp: new Date().toISOString() }],
          round: 1,
        },
        {
          id: "t2",
          title: "Dashboard",
          status: "revealed",
          votes: { a: 3, b: 3 },
          comments: [],
          round: 1,
        },
      ],
    };

    const md = generateExportMarkdown(session);
    expect(md).toContain("# Sprint 42");
    expect(md).toContain("TA2-123");
    expect(md).toContain("Login flow");
    expect(md).toContain("Alice: 5");
    expect(md).toContain("Bob: 8");
    expect(md).toContain("Complex auth logic");
    expect(md).toContain("Dashboard");
  });
});
