import { SolidMarkdown } from "solid-markdown";
import type { SolidMarkdownComponents } from "solid-markdown";
import type { JSX } from "solid-js";

interface MessageContentProps {
  content: string;
}

const components: Partial<SolidMarkdownComponents> = {
  // Links: open in new tab
  a: (props) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      class="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {props.children as unknown as JSX.Element}
    </a>
  ),
  // Code blocks
  code: (props) => {
    if (props.inline) {
      return (
        <code class="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {props.children as unknown as JSX.Element}
        </code>
      );
    }
    return <code class="font-mono text-[0.85em]">{props.children as unknown as JSX.Element}</code>;
  },
  pre: (props) => (
    <pre class="my-1.5 overflow-x-auto rounded-md bg-secondary p-3 font-mono text-[0.85em] text-foreground">
      {props.children as unknown as JSX.Element}
    </pre>
  ),
  // Block quotes
  blockquote: (props) => (
    <blockquote class="my-1 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
      {props.children as unknown as JSX.Element}
    </blockquote>
  ),
  // Lists
  ul: (props) => (
    <ul class="my-1 ml-4 list-disc text-foreground/90">
      {props.children as unknown as JSX.Element}
    </ul>
  ),
  ol: (props) => (
    <ol class="my-1 ml-4 list-decimal text-foreground/90">
      {props.children as unknown as JSX.Element}
    </ol>
  ),
  li: (props) => <li class="my-0.5">{props.children as unknown as JSX.Element}</li>,
  // Paragraphs — avoid extra margins in chat context
  p: (props) => (
    <p class="my-0.5 break-words leading-relaxed">{props.children as unknown as JSX.Element}</p>
  ),
  // Bold/italic/strikethrough use default tags, just add classes if needed
  strong: (props) => (
    <strong class="font-semibold">{props.children as unknown as JSX.Element}</strong>
  ),
  em: (props) => <em>{props.children as unknown as JSX.Element}</em>,
  del: (props) => (
    <del class="text-muted-foreground line-through">{props.children as unknown as JSX.Element}</del>
  ),
  // Headings — render as slightly bolder text, not actual headings (chat context)
  h1: (props) => (
    <p class="my-0.5 text-base font-bold">{props.children as unknown as JSX.Element}</p>
  ),
  h2: (props) => (
    <p class="my-0.5 text-base font-bold">{props.children as unknown as JSX.Element}</p>
  ),
  h3: (props) => <p class="my-0.5 font-semibold">{props.children as unknown as JSX.Element}</p>,
  h4: (props) => <p class="my-0.5 font-semibold">{props.children as unknown as JSX.Element}</p>,
  h5: (props) => <p class="my-0.5 font-medium">{props.children as unknown as JSX.Element}</p>,
  h6: (props) => <p class="my-0.5 font-medium">{props.children as unknown as JSX.Element}</p>,
  // Horizontal rule
  hr: () => <hr class="my-2 border-border" />,
};

const MessageContentComponent = (props: MessageContentProps) => {
  return (
    <div class="text-sm text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <SolidMarkdown children={props.content} components={components} />
    </div>
  );
};

export default MessageContentComponent;
