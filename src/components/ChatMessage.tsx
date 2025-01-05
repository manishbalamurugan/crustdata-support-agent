import React from 'react';
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  isLoading?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, isLoading }) => {
  return (
    <div className={cn(
      "flex gap-3 mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center text-white font-medium text-sm shadow-sm">
          C
        </div>
      )}
      <div
        className={cn(
          "relative flex flex-col max-w-[80%] gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div className={cn(
          "px-4 py-2 rounded-2xl text-sm shadow-sm",
          isUser 
            ? "btn-gradient text-white" 
            : "message-glass text-slate-600"
        )}>
          {isLoading ? (
            <div className="flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>.</span>
            </div>
          ) : isUser ? (
            message
          ) : (
            <ReactMarkdown
              className="prose prose-sm max-w-none prose-pre:bg-transparent prose-pre:p-0"
              components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !my-2"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-slate-100 rounded px-1" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message}
            </ReactMarkdown>
          )}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-slate-500 font-medium text-sm shadow-sm">
          U
        </div>
      )}
    </div>
  );
}; 