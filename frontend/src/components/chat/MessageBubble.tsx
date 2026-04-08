import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, HeartPulse, User } from 'lucide-react';

import type { Message } from '../../store';

export function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
          <HeartPulse className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={`group relative max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed sm:max-w-[75%] ${
          message.role === 'user'
            ? 'rounded-tr-sm bg-white text-black'
            : 'rounded-tl-sm border border-border bg-surface text-textMain'
        }`}
      >
        {message.role === 'assistant' ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        )}

        {message.role === 'assistant' && (
          <button
            onClick={handleCopy}
            className="absolute -right-1 -top-1 rounded border border-border bg-surfaceLight p-1 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Copy message"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-textMuted" />}
          </button>
        )}
      </div>

      {message.role === 'user' && (
        <div className="ml-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surfaceLight">
          <User className="h-4 w-4 text-primary" />
        </div>
      )}
    </motion.div>
  );
}
