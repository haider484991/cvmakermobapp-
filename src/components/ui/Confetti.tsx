/**
 * Confetti Animation Component
 * Celebratory confetti effect for success screens
 */

import { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
  type: 'square' | 'circle' | 'rectangle';
}

interface ConfettiProps {
  /**
   * Whether to show the confetti animation
   */
  active: boolean;

  /**
   * Number of confetti pieces
   */
  count?: number;

  /**
   * Colors for confetti pieces
   */
  colors?: string[];

  /**
   * Animation duration in ms
   */
  duration?: number;

  /**
   * Callback when animation completes
   */
  onComplete?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_COLORS = [
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky blue
  '#FFA07A', // Light salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E9', // Light blue
];

function ConfettiPieceComponent({
  piece,
  duration,
  onComplete,
  isLast,
}: {
  piece: ConfettiPiece;
  duration: number;
  onComplete?: () => void;
  isLast: boolean;
}) {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Random horizontal drift
    const drift = (Math.random() - 0.5) * 100;
    const fallDuration = duration * (0.8 + Math.random() * 0.4);

    // Scale in
    scale.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) })
    );

    // Fall down with drift
    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration: fallDuration,
        easing: Easing.in(Easing.quad),
      })
    );

    // Horizontal drift
    translateX.value = withDelay(
      piece.delay,
      withSequence(
        withTiming(drift / 2, { duration: fallDuration / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(drift, { duration: fallDuration / 2, easing: Easing.inOut(Easing.sin) })
      )
    );

    // Rotate
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation + 720 * (Math.random() > 0.5 ? 1 : -1), {
        duration: fallDuration,
        easing: Easing.linear,
      })
    );

    // Fade out at the end
    opacity.value = withDelay(
      piece.delay + fallDuration * 0.7,
      withTiming(0, {
        duration: fallDuration * 0.3,
      }, () => {
        if (isLast && onComplete) {
          runOnJS(onComplete)();
        }
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const shapeStyle = {
    width: piece.type === 'rectangle' ? piece.size * 0.5 : piece.size,
    height: piece.type === 'rectangle' ? piece.size * 1.5 : piece.size,
    backgroundColor: piece.color,
    borderRadius: piece.type === 'circle' ? piece.size / 2 : piece.type === 'square' ? 2 : 1,
  };

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: piece.x },
        shapeStyle,
        animatedStyle,
      ]}
    />
  );
}

export function Confetti({
  active,
  count = 50,
  colors = DEFAULT_COLORS,
  duration = 3000,
  onComplete,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (active) {
      const types: Array<'square' | 'circle' | 'rectangle'> = ['square', 'circle', 'rectangle'];
      const newPieces: ConfettiPiece[] = Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 500,
        rotation: Math.random() * 360,
        size: 8 + Math.random() * 8,
        type: types[Math.floor(Math.random() * types.length)],
      }));
      setPieces(newPieces);
    } else {
      setPieces([]);
    }
  }, [active, count, colors]);

  if (!active || pieces.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, index) => (
        <ConfettiPieceComponent
          key={piece.id}
          piece={piece}
          duration={duration}
          onComplete={onComplete}
          isLast={index === pieces.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});

export default Confetti;
