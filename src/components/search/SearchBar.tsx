"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================================
// EXAMPLE QUERIES (cycle through these on homepage)
// ============================================================

const EXAMPLE_QUERIES = [
  "Best free AI video generator",
  "Tool for vibe coding",
  "AI image generator without watermark",
  "Trading research tool for beginners",
  "Best AI avatar tool",
  "Free AI coding assistant",
  "AI tool to make website without coding",
  "Best research tool for students",
  "AI music generator",
  "Free SEO tool for beginners",
];

// ============================================================
// SEARCH BAR COMPONENT
// ============================================================

interface SearchBarProps {
  initialQuery?: string;
  variant?: "hero" | "compact";
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
}

export function SearchBar({
  initialQuery = "",
  variant = "hero",
  autoFocus = false,
  onSearch,
}: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [placeholder, setPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Animated placeholder cycling
  useEffect(() => {
    if (query || isFocused) return;

    let charIndex = 0;
    const currentExample = EXAMPLE_QUERIES[placeholderIndex];
    let isDeleting = false;
    let pauseTimer: ReturnType<typeof setTimeout>;

    const typeInterval = setInterval(() => {
      if (!isDeleting) {
        charIndex++;
        setPlaceholder(currentExample.slice(0, charIndex));
        if (charIndex === currentExample.length) {
          isDeleting = true;
          pauseTimer = setTimeout(() => {}, 2000);
          clearInterval(typeInterval);
          pauseTimer = setTimeout(() => {
            const deleteInterval = setInterval(() => {
              charIndex--;
              setPlaceholder(currentExample.slice(0, charIndex));
              if (charIndex === 0) {
                clearInterval(deleteInterval);
                setPlaceholderIndex((prev) => (prev + 1) % EXAMPLE_QUERIES.length);
              }
            }, 30);
          }, 2000);
        }
      }
    }, 60);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(pauseTimer);
    };
  }, [placeholderIndex, query, isFocused]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      if (onSearch) {
        onSearch(trimmed);
      } else {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [query, onSearch, router]
  );

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    if (onSearch) {
      onSearch(example);
    } else {
      router.push(`/search?q=${encodeURIComponent(example)}`);
    }
  };

  const isHero = variant === "hero";

  return (
    <div className="w-full">
      <form action="/search" onSubmit={handleSubmit} className="relative w-full">
        {/* Search Icon */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground ${
            isHero ? "left-6 w-7 h-7" : "left-4 w-5 h-5"
          }`}
        >
          {isTyping ? (
            <Sparkles className={isHero ? "w-7 h-7" : "w-5 h-5"} />
          ) : (
            <Search className={isHero ? "w-7 h-7" : "w-5 h-5"} />
          )}
        </div>

        {/* Input */}
        <Input
          ref={inputRef}
          id="youvo-search-input"
          name="q"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsTyping(e.target.value.length > 0);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || "Search for anything..."}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`
            w-full border-border/50 bg-card/50 backdrop-blur-sm
            placeholder:text-muted-foreground/50
            focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40
            transition-all duration-200
            ${isHero
              ? "h-20 text-xl pl-16 pr-24 rounded-2xl shadow-2xl shadow-black/20 border-2"
              : "h-12 text-base pl-12 pr-16 rounded-xl border-2"
            }
          `}
        />

        {/* Action buttons */}
        <div
          className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 ${
            isHero ? "right-3" : "right-2"
          }`}
        >
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl transition-colors
              ${variant === "hero" 
                ? "h-14 w-16 bg-primary text-primary-foreground hover:bg-primary/90" 
                : "h-9 w-10 text-muted-foreground hover:text-foreground"
              }
            `}
            aria-label="Search"
          >
            <ArrowRight className={isHero ? "w-6 h-6" : "w-5 h-5"} />
          </button>
        </div>
      </form>

      {/* Example queries (only on hero variant) */}
      {isHero && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.slice(0, 4).map((example) => (
            <button
              key={example}
              onClick={() => handleExampleClick(example)}
              className="
                px-4 py-2 text-sm font-medium rounded-full
                bg-muted/50 text-muted-foreground
                hover:bg-muted hover:text-foreground
                border border-border/30
                transition-all duration-200
              "
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
