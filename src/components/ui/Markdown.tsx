import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMediaUrl } from "@/lib/media";

// CMS Markdown → React. react-markdown never renders raw HTML from content, so editors can't inject scripts.
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h2 className="mb-3 mt-0 text-2xl font-bold" {...p} />,
        h2: (p) => <h2 className="mb-2 mt-4 text-xl font-semibold first:mt-0" {...p} />,
        h3: (p) => <h3 className="mb-2 mt-3 text-lg font-semibold first:mt-0" {...p} />,
        p: (p) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0" {...p} />,
        ul: (p) => <ul className="my-2 list-disc pl-5" {...p} />,
        ol: (p) => <ol className="my-2 list-decimal pl-5" {...p} />,
        table: (p) => (
          <div className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...p} />
          </div>
        ),
        th: (p) => <th className="border-b border-gray-300 py-2 pr-4 text-left font-semibold" {...p} />,
        td: (p) => <td className="border-b border-gray-100 py-2 pr-4" {...p} />,
        // Pictures from the CMS media library only (no third-party hosts or tracking pixels), scaled to the column.
        // Their size isn't known up front, so they can't go through next/image.
        img: ({ src, alt }) =>
          isMediaUrl(src) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="my-3 h-auto max-w-full rounded" />
          ) : null,
        a: ({ href = "", children }) =>
          /^\/(?!\/)/.test(href) || href.startsWith("#") ? (
            <Link href={href} className="text-orange-800 underline">
              {children}
            </Link>
          ) : (
            <a
              href={href}
              className="text-orange-800 underline"
              {...(href.startsWith("http") && { rel: "noopener noreferrer", target: "_blank" })}
            >
              {children}
            </a>
          ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
