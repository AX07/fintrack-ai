import { useState, useCallback } from 'react';

const API_KEY_STORAGE_KEY = 'finTrackGeminiApiKey';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(getApiKey);

  const saveApiKey = useCallback((key: string) => {
    if (!key || key.trim() === '') {
        console.warn("Attempted to save an empty API key.");
        return;
    }
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key);
    } catch (error) {
      console.error("Failed to save API key to localStorage", error);
    }
  }, []);
  
  const removeApiKey = useCallback(() => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKey(null);
    } catch (error) {
      console.error("Failed to remove API key from localStorage", error);
    }
  }, []);

  return { apiKey, saveApiKey, removeApiKey };
}
