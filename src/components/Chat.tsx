"use client"
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

interface Message {
  text: string;
  isUser: boolean;
  isLoading?: boolean;
}

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! I'm your Crustdata API assistant. How can I help you today?",
      isUser: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Format message if it looks like code
  const formatMessage = (text: string) => {
    // Check if the text looks like JSON
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        JSON.parse(text);
        return '\`\`\`json\n' + text + '\n\`\`\`';
      } catch (e) {}
    }
    
    // Check if it looks like a URL or API endpoint
    if (text.includes('http') || text.includes('/api/')) {
      return '\`\`\`\n' + text + '\n\`\`\`';
    }
    
    return text;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = formatMessage(input.trim());
    setInput('');
    setIsLoading(true);
    
    // Add user message
    setMessages((prev) => [...prev, { text: userMessage, isUser: true }]);
    
    // Add temporary loading message
    setMessages((prev) => [...prev, { text: '', isUser: false, isLoading: true }]);

    try {
      const history = messages.map(m => m.text);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Replace loading message with actual response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          text: data.response,
          isUser: false,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      // Replace loading message with error message
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          text: "I apologize, but I'm having trouble responding right now. Please try again.",
          isUser: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[700px] w-full max-w-3xl mx-auto glass">
      <ScrollArea className="flex-1 p-4 h-full">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message.text}
              isUser={message.isUser}
              isLoading={message.isLoading}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-black/[0.03]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about Crustdata API..."
            className="flex-1 input-glass text-slate-600 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] max-h-[200px] resize-none"
            disabled={isLoading}
          />
          <Button 
            type="submit"
            size="icon"
            disabled={isLoading}
            className="btn-gradient self-end h-11 w-11"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}; 