import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

import type { Message } from '../../store';

export function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`group relative max-w-[85%] sm:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* The Bubble */}
        <div
          className={`relative px-5 py-3 text-[15px] leading-relaxed shadow-sm
            ${isUser 
              ? 'bg-primary text-white rounded-[22px] rounded-br-[6px]' 
              : 'bg-white text-textMain rounded-[22px] rounded-bl-[6px] border border-black/[0.04]'
            }`}
        >
           {isUser ? (
             <span style={{ whiteSpace: 'pre-wrap' }} className="font-normal">{message.content}</span>
           ) : (
             <div className="markdown-body prose prose-slate prose-sm max-w-none">
               <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
             </div>
           )}

           {/* Copy Button (only for Assistant) */}
           {!isUser && (
             <button
               onClick={handleCopy}
               className="absolute -right-10 top-2 p-1.5 rounded-full bg-white border border-black/[0.04] shadow-sm opacity-0 transition-all group-hover:opacity-100 hover:scale-105 active:scale-95"
               aria-label="Copy message"
             >
               {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-textMuted" />}
             </button>
           )}
        </div>

        <span className="text-[11px] text-textMuted/60 font-medium px-2 mt-1">
           {isUser ? 'Delivered' : 'MediSonar'}
        </span>
      </div>
    </motion.div>
  );
}
