import DOMPurify from "isomorphic-dompurify";

interface Props {
  html: string;
  className?: string;
}

export default function RichTextDisplay({ html, className = "" }: Props) {
  if (!html || html === "<p></p>") return null;
  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
