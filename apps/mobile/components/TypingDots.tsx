import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

/** The three-dot indicator a chat shows while the other side is composing. */
export function TypingDots({ color = "#4B5FE8", size = 7 }: { color?: string; size?: number }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    // Each dot runs the same lift, staggered, so the wave reads left to right.
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 160),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [dots]);

  return (
    <View style={s.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.6] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 },
});
