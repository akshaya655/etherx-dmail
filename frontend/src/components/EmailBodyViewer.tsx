"use client"

import React, { useState, useEffect, useId, useRef } from "react"

interface EmailBodyViewerProps {
  content?: string
  html?: string
  minHeight?: string
  style?: React.CSSProperties
  className?: string
}

// Regex to detect HTML elements including line breaks (<br>), paragraphs (<p>), formatting, etc.
const HTML_TAG_REGEX = /<(br|p|div|b|i|u|strong|em|a|ul|ol|li|span|h[1-6]|table|tr|td|blockquote|style|html|body|header|section|code|pre)\b[^>]*>/i

export const isHTMLContent = (text?: string): boolean => {
  if (!text) return false
  return HTML_TAG_REGEX.test(text)
}

export const EmailBodyViewer: React.FC<EmailBodyViewerProps> = ({
  content = "",
  html = "",
  minHeight,
  style,
  className = "",
}) => {
  const rawHtml = html || content
  const instanceId = useId().replace(/:/g, "_")
  const [iframeHeight, setIframeHeight] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        e.data &&
        typeof e.data === "object" &&
        e.data.type === "EMBED_EMAIL_RESIZE" &&
        e.data.id === instanceId
      ) {
        if (typeof e.data.height === "number" && e.data.height > 0) {
          setIframeHeight(Math.ceil(e.data.height))
        }
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [instanceId])

  if (rawHtml && (html || isHTMLContent(rawHtml))) {
    const documentDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #e0e0e0;
              background-color: #121212;
              margin: 0;
              padding: 16px;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            /* Override Gmail/External inline white background styles */
            table, td, th, div, section, article, aside, header, footer, main, p, span {
              background-color: transparent !important;
              color: inherit !important;
            }
            a {
              color: #E8B923 !important;
              text-decoration: underline;
            }
            img, video, iframe, table {
              max-width: 100% !important;
              height: auto !important;
            }
            blockquote {
              border-left: 3px solid #E8B923 !important;
              margin: 8px 0 !important;
              padding-left: 12px !important;
              color: #a0a0a0 !important;
            }
            pre, code {
              background-color: rgba(255, 255, 255, 0.05) !important;
              color: #e0e0e0 !important;
              padding: 4px 8px;
              border-radius: 4px;
              white-space: pre-wrap;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          ${rawHtml}
          <script>
            // 1. Clean copy handler - strip all HTML/CSS tags on copy
            document.addEventListener('copy', function(e) {
              var selection = window.getSelection();
              if (selection && !selection.isCollapsed) {
                var text = selection.toString();
                text = text.replace(/<[^>]+>/g, '');
                e.clipboardData.setData('text/plain', text);
                e.preventDefault();
              }
            });

            // 2. Auto-resize observer & postMessage sender
            function sendResize() {
              var body = document.body;
              var html = document.documentElement;
              if (!body || !html) return;
              var height = Math.max(
                body.scrollHeight, body.offsetHeight, body.clientHeight,
                html.scrollHeight, html.offsetHeight, html.clientHeight
              );
              if (height > 0) {
                window.parent.postMessage({
                  type: 'EMBED_EMAIL_RESIZE',
                  id: '${instanceId}',
                  height: height
                }, '*');
              }
            }

            window.addEventListener('load', sendResize);
            window.addEventListener('resize', sendResize);
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', sendResize);
            } else {
              sendResize();
            }
            setTimeout(sendResize, 100);
            setTimeout(sendResize, 400);
            setTimeout(sendResize, 1000);
          </script>
        </body>
      </html>
    `

    const computedMinHeight = minHeight || "40px"
    const effectiveHeight = iframeHeight ? `${iframeHeight}px` : computedMinHeight

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          borderRadius: "10px",
          overflow: "hidden",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(212, 175, 55, 0.2)",
          width: "100%",
          transition: "height 0.15s ease",
          ...style,
        }}
      >
        <iframe
          srcDoc={documentDoc}
          sandbox="allow-popups allow-scripts"
          style={{
            width: "100%",
            height: effectiveHeight,
            minHeight: computedMinHeight,
            border: "none",
            background: "#121212",
            display: "block",
            colorScheme: "dark",
          }}
        />
      </div>
    )
  }

  // Fallback: Plain text rendering (convert any stray <br> tags to real linebreaks)
  const formattedPlainText = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")

  return (
    <div
      className={className}
      onCopy={(e) => {
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) {
          const clean = sel.toString().replace(/<[^>]+>/g, "")
          e.clipboardData.setData("text/plain", clean)
          e.preventDefault()
        }
      }}
      style={{
        color: "var(--text-bright)",
        fontSize: "14px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "'Inter', sans-serif",
        padding: "16px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(212, 175, 55, 0.2)",
        borderRadius: "10px",
        ...style,
      }}
    >
      {formattedPlainText}
    </div>
  )
}

export default EmailBodyViewer
