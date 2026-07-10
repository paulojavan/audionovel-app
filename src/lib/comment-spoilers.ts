const OPEN_TAG = "[spoiler]";
const CLOSE_TAG = "[/spoiler]";

export type CommentTextSegment = { type: "text"; content: string };
export type CommentSpoilerSegment = { type: "spoiler"; content: string };
export type CommentSegment = CommentTextSegment | CommentSpoilerSegment;

export function parseCommentSpoilers(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let cursor = 0;

  const appendText = (content: string) => {
    if (!content) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === "text") previous.content += content;
    else segments.push({ type: "text", content });
  };

  while (cursor < body.length) {
    const openIndex = body.indexOf(OPEN_TAG, cursor);
    if (openIndex < 0) {
      appendText(body.slice(cursor));
      break;
    }

    appendText(body.slice(cursor, openIndex));
    const contentStart = openIndex + OPEN_TAG.length;
    const closeIndex = body.indexOf(CLOSE_TAG, contentStart);
    if (closeIndex < 0) {
      appendText(body.slice(openIndex));
      break;
    }

    const rawEnd = closeIndex + CLOSE_TAG.length;
    const content = body.slice(contentStart, closeIndex);
    if (!content || content.includes(OPEN_TAG) || content.includes(CLOSE_TAG)) {
      appendText(body.slice(openIndex, rawEnd));
      cursor = rawEnd;
      continue;
    }

    segments.push({ type: "spoiler", content });
    cursor = rawEnd;
  }

  return segments;
}
