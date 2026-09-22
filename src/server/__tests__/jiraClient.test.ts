import { adfToPlainText } from "../jiraClient";

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
