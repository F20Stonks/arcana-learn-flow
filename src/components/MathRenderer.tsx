import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Shared math + markdown renderer. Uses remark-math + rehype-katex so inline
 * math stays truly inline inside paragraphs (no forced block breaks).
 */
export function MathRenderer({ content }: { content: string }) {
  return (
    <div className="math-renderer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Custom markdown components for consistent dark-theme styling
const markdownComponents = {
  h1: ({ children, ...props }: any) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2" {...props}>{children}</h1>,
  h2: ({ children, ...props }: any) => <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5" {...props}>{children}</h2>,
  h3: ({ children, ...props }: any) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1" {...props}>{children}</h3>,
  p: ({ children, ...props }: any) => <p className="text-sm leading-relaxed text-foreground mb-2 last:mb-0" {...props}>{children}</p>,
  strong: ({ children, ...props }: any) => <strong className="font-semibold text-foreground" {...props}>{children}</strong>,
  em: ({ children, ...props }: any) => <em className="italic text-foreground/90" {...props}>{children}</em>,
  ul: ({ children, ...props }: any) => <ul className="list-disc list-inside text-sm text-foreground space-y-1 mb-2 ml-1" {...props}>{children}</ul>,
  ol: ({ children, ...props }: any) => <ol className="list-decimal list-inside text-sm text-foreground space-y-1 mb-2 ml-1" {...props}>{children}</ol>,
  li: ({ children, ...props }: any) => <li className="text-sm text-foreground" {...props}>{children}</li>,
  code: ({ children, className, ...props }: any) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <pre className="bg-accent rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto mb-2"><code {...props}>{children}</code></pre>;
    }
    return <code className="bg-accent px-1.5 py-0.5 rounded text-xs font-mono text-primary" {...props}>{children}</code>;
  },
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic mb-2" {...props}>{children}</blockquote>
  ),
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto mb-2"><table className="text-xs w-full border-collapse" {...props}>{children}</table></div>
  ),
  th: ({ children, ...props }: any) => <th className="border border-border px-2 py-1 text-left font-medium text-foreground bg-accent" {...props}>{children}</th>,
  td: ({ children, ...props }: any) => <td className="border border-border px-2 py-1 text-muted-foreground" {...props}>{children}</td>,
};

export default MathRenderer;
