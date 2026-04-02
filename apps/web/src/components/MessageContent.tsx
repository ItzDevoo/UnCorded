import { Lexer, type Token, type Tokens } from "marked";
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) return url;
  } catch {
    /* invalid URL */
  }
  return "#";
}

function renderInlineTokens(tokens: Token[]): JSX.Element {
  return <For each={tokens}>{(t) => renderToken(t)}</For>;
}

function renderToken(token: Token): JSX.Element {
  switch (token.type) {
    case "strong":
      return (
        <strong class="font-semibold">{renderInlineTokens((token as Tokens.Strong).tokens)}</strong>
      );
    case "em":
      return <em>{renderInlineTokens((token as Tokens.Em).tokens)}</em>;
    case "del":
      return (
        <del class="text-muted-foreground line-through">
          {renderInlineTokens((token as Tokens.Del).tokens)}
        </del>
      );
    case "codespan":
      return (
        <code class="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {(token as Tokens.Codespan).text}
        </code>
      );
    case "link":
      return (
        <a
          href={sanitizeUrl((token as Tokens.Link).href)}
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {renderInlineTokens((token as Tokens.Link).tokens)}
        </a>
      );
    case "code":
      return (
        <pre class="my-1.5 overflow-x-auto rounded-md bg-secondary p-3 font-mono text-[0.85em] text-foreground">
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      );
    case "paragraph":
      return (
        <p class="my-0.5 break-words leading-relaxed">
          {renderInlineTokens((token as Tokens.Paragraph).tokens)}
        </p>
      );
    case "blockquote":
      return (
        <blockquote class="my-1 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
          <For each={(token as Tokens.Blockquote).tokens}>{(t) => renderToken(t)}</For>
        </blockquote>
      );
    case "list": {
      const listToken = token as Tokens.List;
      return (
        <Show
          when={listToken.ordered}
          fallback={
            <ul class="my-1 ml-4 list-disc text-foreground/90">
              <For each={listToken.items}>{(item) => renderListItem(item)}</For>
            </ul>
          }
        >
          <ol class="my-1 ml-4 list-decimal text-foreground/90">
            <For each={listToken.items}>{(item) => renderListItem(item)}</For>
          </ol>
        </Show>
      );
    }
    case "heading": {
      const depth = (token as Tokens.Heading).depth;
      const cls =
        depth <= 2
          ? "my-0.5 text-base font-bold"
          : depth <= 4
            ? "my-0.5 font-semibold"
            : "my-0.5 font-medium";
      return <p class={cls}>{renderInlineTokens((token as Tokens.Heading).tokens)}</p>;
    }
    case "hr":
      return <hr class="my-2 border-border" />;
    case "br":
      return <br />;
    case "escape":
      return <>{(token as Tokens.Escape).text}</>;
    case "space":
      return null;
    case "text": {
      const textToken = token as Tokens.Text;
      if ("tokens" in textToken && textToken.tokens) {
        return renderInlineTokens(textToken.tokens);
      }
      return <>{textToken.text}</>;
    }
    default:
      return <>{(token as Tokens.Generic).raw ?? ""}</>;
  }
}

function renderListItem(item: Tokens.ListItem): JSX.Element {
  return (
    <li class="my-0.5">
      <For each={item.tokens}>{(t) => renderToken(t)}</For>
    </li>
  );
}

export default function MessageContent(props: { content: string }) {
  const tokens = () => Lexer.lex(props.content);
  return (
    <div class="text-sm text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <For each={tokens()}>{(token) => renderToken(token)}</For>
    </div>
  );
}
