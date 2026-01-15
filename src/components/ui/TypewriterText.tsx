import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Text, TextStyle, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

interface TypewriterTextProps {
  /**
   * The text to display with typewriter effect
   */
  text: string;

  /**
   * Whether streaming is in progress (shows cursor)
   */
  isStreaming?: boolean;

  /**
   * Delay between each character in ms (only for non-streaming mode)
   */
  delay?: number;

  /**
   * Text style
   */
  style?: TextStyle;

  /**
   * Callback when typing animation completes
   */
  onComplete?: () => void;

  /**
   * Whether to show blinking cursor
   */
  showCursor?: boolean;

  /**
   * Cursor character
   */
  cursorChar?: string;
}

/**
 * Blinking cursor component
 */
function BlinkingCursor({ color, size }: { color: string; size: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width: 2,
          height: size,
          backgroundColor: color,
          marginLeft: 2,
          borderRadius: 1,
        },
      ]}
    />
  );
}

/**
 * TypewriterText component
 *
 * Displays text with a typewriter/streaming effect like ChatGPT.
 * Can be used in two modes:
 * 1. Streaming mode: Pass text directly as it arrives from API
 * 2. Animation mode: Pass full text and it will animate character by character
 */
export function TypewriterText({
  text,
  isStreaming = false,
  delay = 30,
  style,
  onComplete,
  showCursor = true,
  cursorChar,
}: TypewriterTextProps) {
  const { colors } = useTheme();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const previousTextRef = useRef('');
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // For streaming mode: directly show the text as it arrives
  useEffect(() => {
    if (isStreaming) {
      setDisplayedText(text);
      setIsTyping(true);
    }
  }, [text, isStreaming]);

  // For non-streaming mode: animate the text character by character
  useEffect(() => {
    if (isStreaming) return;

    // Clear any existing animation
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }

    // Reset if text changed completely
    if (!text.startsWith(previousTextRef.current)) {
      setDisplayedText('');
      previousTextRef.current = '';
    }

    const targetText = text;
    let currentIndex = previousTextRef.current.length;

    if (currentIndex >= targetText.length) {
      setIsTyping(false);
      onComplete?.();
      return;
    }

    setIsTyping(true);

    const typeNextChar = () => {
      if (currentIndex < targetText.length) {
        setDisplayedText(targetText.slice(0, currentIndex + 1));
        currentIndex++;
        previousTextRef.current = targetText.slice(0, currentIndex);
        animationRef.current = setTimeout(typeNextChar, delay);
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };

    typeNextChar();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [text, delay, isStreaming, onComplete]);

  // Update typing state when streaming stops
  useEffect(() => {
    if (!isStreaming && displayedText === text) {
      setIsTyping(false);
    }
  }, [isStreaming, displayedText, text]);

  const fontSize = (style?.fontSize as number) || 14;
  const textColor = (style?.color as string) || colors.text;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Text style={[{ color: colors.text, fontSize: 14, lineHeight: 20 }, style]}>
        {displayedText}
        {cursorChar && (isTyping || isStreaming) && cursorChar}
      </Text>
      {showCursor && (isTyping || isStreaming) && !cursorChar && (
        <BlinkingCursor color={textColor} size={fontSize} />
      )}
    </View>
  );
}

/**
 * Hook for managing streaming text state
 */
export function useStreamingText(initialText = '') {
  const [text, setText] = useState(initialText);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const startStreaming = useCallback(() => {
    setText('');
    setIsStreaming(true);
    setIsComplete(false);
  }, []);

  const appendText = useCallback((chunk: string) => {
    setText((prev) => prev + chunk);
  }, []);

  const setFullText = useCallback((fullText: string) => {
    setText(fullText);
  }, []);

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    setText('');
    setIsStreaming(false);
    setIsComplete(false);
  }, []);

  return {
    text,
    isStreaming,
    isComplete,
    startStreaming,
    appendText,
    setFullText,
    stopStreaming,
    reset,
  };
}

export default TypewriterText;
