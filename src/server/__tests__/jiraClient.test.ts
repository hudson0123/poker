import { adfToMarkdown, adfToPlainText } from "../jiraClient";

describe("adfToPlainText", () => {
  it("extracts text from a simple paragraph", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("Hello world");
  });

  it("handles multiple paragraphs with line breaks", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First paragraph" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
      ],
    };
    expect(adfToPlainText(adf)).toBe("First paragraph\n\nSecond paragraph");
  });

  it("handles bullet lists", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item 1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item 2" }] }] },
          ],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("- Item 1\n- Item 2");
  });

  it("handles ordered lists", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Step 1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Step 2" }] }] },
          ],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("1. Step 1\n2. Step 2");
  });

  it("handles inline formatting (bold, italic)", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is " },
            { type: "text", text: "bold", marks: [{ type: "strong" }] },
            { type: "text", text: " text" },
          ],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("This is bold text");
  });

  it("handles headings", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Section Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
      ],
    };
    expect(adfToPlainText(adf)).toBe("Section Title\n\nBody text");
  });

  it("handles code blocks", () => {
    const adf = {
      type: "doc",
      content: [
        { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
      ],
    };
    expect(adfToPlainText(adf)).toBe("const x = 1;");
  });

  it("handles mentions", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Assigned to " },
            { type: "mention", attrs: { text: "@alice" } },
          ],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("Assigned to @alice");
  });

  it("returns empty string for null/undefined", () => {
    expect(adfToPlainText(null)).toBe("");
    expect(adfToPlainText(undefined)).toBe("");
  });

  it("handles links", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See ", marks: [] },
            { type: "text", text: "this link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
          ],
        },
      ],
    };
    expect(adfToPlainText(adf)).toBe("See this link");
  });
});

describe("adfToMarkdown", () => {
  const doc = (...content: unknown[]) => ({ type: "doc", content });
  const p = (...content: unknown[]) => ({ type: "paragraph", content });
  const t = (text: string, marks?: unknown[]) => ({ type: "text", text, marks });
  const li = (...content: unknown[]) => ({ type: "listItem", content });

  it("renders headings with their level", () => {
    const adf = doc(
      { type: "heading", attrs: { level: 2 }, content: [t("Acceptance Criteria")] },
      p(t("Body text"))
    );
    expect(adfToMarkdown(adf)).toBe("## Acceptance Criteria\n\nBody text");
  });

  it("renders inline marks", () => {
    const adf = doc(
      p(
        t("bold", [{ type: "strong" }]),
        t(" "),
        t("italic", [{ type: "em" }]),
        t(" "),
        t("gone", [{ type: "strike" }]),
        t(" "),
        t("x = 1", [{ type: "code" }]),
        t(" "),
        t("docs", [{ type: "link", attrs: { href: "https://example.com" } }])
      )
    );
    expect(adfToMarkdown(adf)).toBe("**bold** *italic* ~~gone~~ `x = 1` [docs](https://example.com)");
  });

  it("escapes markdown characters in plain text", () => {
    expect(adfToMarkdown(doc(p(t("use *args and <div> [x]"))))).toBe("use \\*args and \\<div> \\[x\\]");
  });

  it("renders bullet and ordered lists, including nesting", () => {
    const adf = doc(
      {
        type: "bulletList",
        content: [
          li(p(t("Parent")), { type: "bulletList", content: [li(p(t("Child")))] }),
          li(p(t("Sibling"))),
        ],
      },
      { type: "orderedList", attrs: { order: 3 }, content: [li(p(t("Three"))), li(p(t("Four")))] }
    );
    expect(adfToMarkdown(adf)).toBe("- Parent\n  - Child\n- Sibling\n\n3. Three\n4. Four");
  });

  it("renders task lists", () => {
    const adf = doc({
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { state: "DONE" }, content: [t("Done thing")] },
        { type: "taskItem", attrs: { state: "TODO" }, content: [t("Todo thing")] },
      ],
    });
    expect(adfToMarkdown(adf)).toBe("- [x] Done thing\n- [ ] Todo thing");
  });

  it("renders code blocks with language and without escaping", () => {
    const adf = doc({ type: "codeBlock", attrs: { language: "ts" }, content: [t("const a = b * c;")] });
    expect(adfToMarkdown(adf)).toBe("```ts\nconst a = b * c;\n```");
  });

  it("renders blockquotes, panels and rules", () => {
    const adf = doc(
      { type: "blockquote", content: [p(t("Quoted"))] },
      { type: "panel", attrs: { panelType: "info" }, content: [p(t("Note"))] },
      { type: "rule" }
    );
    expect(adfToMarkdown(adf)).toBe("> Quoted\n\n> Note\n\n---");
  });

  it("renders tables as GFM tables", () => {
    const cell = (type: string, text: string) => ({ type, content: [p(t(text))] });
    const adf = doc({
      type: "table",
      content: [
        { type: "tableRow", content: [cell("tableHeader", "Field"), cell("tableHeader", "Value")] },
        { type: "tableRow", content: [cell("tableCell", "a|b"), cell("tableCell", "1")] },
      ],
    });
    expect(adfToMarkdown(adf)).toBe("| Field | Value |\n| --- | --- |\n| a\\|b | 1 |");
  });

  it("renders hard breaks, mentions, emoji and inline cards", () => {
    const adf = doc(
      p(
        t("Line one"),
        { type: "hardBreak" },
        { type: "mention", attrs: { text: "@alice" } },
        t(" "),
        { type: "emoji", attrs: { shortName: ":tada:", text: "🎉" } },
        t(" "),
        { type: "inlineCard", attrs: { url: "https://talkiatry.atlassian.net/browse/TA2-1" } }
      )
    );
    expect(adfToMarkdown(adf)).toBe(
      "Line one  \n@alice 🎉 [https://talkiatry.atlassian.net/browse/TA2-1](https://talkiatry.atlassian.net/browse/TA2-1)"
    );
  });

  it("skips media and returns empty string for null/undefined", () => {
    expect(adfToMarkdown(doc({ type: "mediaSingle", content: [{ type: "media", attrs: {} }] }, p(t("x"))))).toBe("x");
    expect(adfToMarkdown(null)).toBe("");
    expect(adfToMarkdown(undefined)).toBe("");
  });
});
