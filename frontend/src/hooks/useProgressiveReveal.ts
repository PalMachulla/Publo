/**
 * useProgressiveReveal - Smooth word-by-word text reveal hook
 * 
 * Instead of showing text instantly (which can feel jarring after pauses),
 * this hook reveals text progressively word-by-word for a smoother UX.
 * 
 * Usage:
 *   const { displayedText, reveal, isRevealing, cancel } = useProgressiveReveal();
 *   
 *   // When full text is ready
 *   await reveal("Hello world, this is a smooth reveal!");
 *   
 *   // In render
 *   <p>{displayedText}</p>
 */

import { useState, useRef, useCallback } from 'react';

interface UseProgressiveRevealOptions {
  /** Delay between words in ms (default: 30) */
  wordDelay?: number;
  /** Delay between characters for very short reveals (default: 15) */
  charDelay?: number;
  /** If text is longer than this, use word-based reveal (default: 50) */
  charThreshold?: number;
  /** Callback when reveal completes */
  onComplete?: () => void;
}

interface UseProgressiveRevealReturn {
  /** The currently displayed (revealed) text */
  displayedText: string;
  /** Whether a reveal is in progress */
  isRevealing: boolean;
  /** Start revealing the given text */
  reveal: (fullText: string) => Promise<void>;
  /** Cancel ongoing reveal and show full text immediately */
  cancel: () => void;
  /** Reset to empty state */
  reset: () => void;
  /** Append text instantly (for real-time streaming) */
  append: (text: string) => void;
}

export function useProgressiveReveal(
  options: UseProgressiveRevealOptions = {}
): UseProgressiveRevealReturn {
  const {
    wordDelay = 30,
    charDelay = 15,
    charThreshold = 50,
    onComplete,
  } = options;

  const [displayedText, setDisplayedText] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  
  const fullTextRef = useRef('');
  const cancelledRef = useRef(false);
  const revealPromiseRef = useRef<Promise<void> | null>(null);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const reveal = useCallback(async (fullText: string): Promise<void> => {
    // If already revealing, cancel and start fresh
    if (isRevealing) {
      cancelledRef.current = true;
      await revealPromiseRef.current;
    }

    fullTextRef.current = fullText;
    cancelledRef.current = false;
    setIsRevealing(true);

    const revealPromise = (async () => {
      try {
        // For short text, reveal char-by-char
        if (fullText.length < charThreshold) {
          let revealed = '';
          for (const char of fullText) {
            if (cancelledRef.current) break;
            revealed += char;
            setDisplayedText(revealed);
            await sleep(charDelay);
          }
        } else {
          // For longer text, reveal word-by-word
          const words = fullText.split(/(\s+)/); // Keep whitespace
          let revealed = '';
          
          for (const word of words) {
            if (cancelledRef.current) break;
            revealed += word;
            setDisplayedText(revealed);
            
            // Only delay on actual words, not whitespace
            if (word.trim()) {
              await sleep(wordDelay);
            }
          }
        }

        // Ensure full text is shown
        if (!cancelledRef.current) {
          setDisplayedText(fullText);
          onComplete?.();
        }
      } finally {
        setIsRevealing(false);
      }
    })();

    revealPromiseRef.current = revealPromise;
    return revealPromise;
  }, [wordDelay, charDelay, charThreshold, isRevealing, onComplete]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setDisplayedText(fullTextRef.current);
    setIsRevealing(false);
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    fullTextRef.current = '';
    setDisplayedText('');
    setIsRevealing(false);
  }, []);

  const append = useCallback((text: string) => {
    setDisplayedText(prev => prev + text);
    fullTextRef.current += text;
  }, []);

  return {
    displayedText,
    isRevealing,
    reveal,
    cancel,
    reset,
    append,
  };
}

/**
 * Utility: Detect if there's been a significant gap in streaming
 * Used for hybrid streaming - switch to buffered mode on pauses
 */
export function createGapDetector(thresholdMs: number = 500) {
  let lastTime = Date.now();
  let buffer = '';

  return {
    /** Record a token and check if there was a gap */
    addToken(token: string): { hadGap: boolean; buffer: string } {
      const now = Date.now();
      const gap = now - lastTime;
      lastTime = now;

      const hadGap = gap > thresholdMs && buffer.length > 0;
      const resultBuffer = hadGap ? buffer : '';
      
      if (hadGap) {
        buffer = token;
      } else {
        buffer += token;
      }

      return { hadGap, buffer: resultBuffer };
    },

    /** Get current buffer without clearing */
    getBuffer(): string {
      return buffer;
    },

    /** Clear and return buffer */
    flush(): string {
      const result = buffer;
      buffer = '';
      return result;
    },

    /** Reset state */
    reset(): void {
      lastTime = Date.now();
      buffer = '';
    },
  };
}
