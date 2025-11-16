import { useState, useEffect } from "react";

/**
 * Hook to manage product tour state
 */
export const useProductTour = (storageKey: string = "product-tour-completed") => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setIsCompleted(!!completed);
  }, [storageKey]);

  const startTour = () => {
    setIsOpen(true);
    setIsCompleted(false);
    localStorage.removeItem(storageKey);
  };

  const completeTour = () => {
    setIsOpen(false);
    setIsCompleted(true);
    localStorage.setItem(storageKey, "true");
  };

  const resetTour = () => {
    localStorage.removeItem(storageKey);
    setIsCompleted(false);
    setIsOpen(false);
  };

  return {
    isCompleted,
    isOpen,
    startTour,
    completeTour,
    resetTour,
  };
};



