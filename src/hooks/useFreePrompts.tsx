import { useState, useEffect } from "react";

const FREE_PROMPTS_KEY = "prossmind_free_prompts";
const MAX_FREE_PROMPTS = 5;

export const useFreePrompts = (isAuthenticated: boolean) => {
  const [remainingPrompts, setRemainingPrompts] = useState<number>(MAX_FREE_PROMPTS);
  const [hasUsedAllPrompts, setHasUsedAllPrompts] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem(FREE_PROMPTS_KEY);
      const used = stored ? parseInt(stored, 10) : 0;
      const remaining = Math.max(0, MAX_FREE_PROMPTS - used);
      setRemainingPrompts(remaining);
      setHasUsedAllPrompts(remaining === 0);
    } else {
      // Authenticated users have unlimited prompts
      setRemainingPrompts(Infinity);
      setHasUsedAllPrompts(false);
    }
  }, [isAuthenticated]);

  const usePrompt = (): boolean => {
    if (isAuthenticated) {
      return true; // Authenticated users can always use prompts
    }

    if (hasUsedAllPrompts) {
      return false;
    }

    const stored = localStorage.getItem(FREE_PROMPTS_KEY);
    const used = stored ? parseInt(stored, 10) : 0;

    if (used >= MAX_FREE_PROMPTS) {
      setHasUsedAllPrompts(true);
      setRemainingPrompts(0);
      return false;
    }

    const newUsed = used + 1;
    localStorage.setItem(FREE_PROMPTS_KEY, newUsed.toString());
    setRemainingPrompts(MAX_FREE_PROMPTS - newUsed);
    
    if (newUsed >= MAX_FREE_PROMPTS) {
      setHasUsedAllPrompts(true);
    }

    return true;
  };

  return {
    remainingPrompts,
    hasUsedAllPrompts,
    usePrompt,
    isUnlimited: isAuthenticated,
  };
};
