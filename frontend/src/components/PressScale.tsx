import React from "react";
import { Pressable, ViewStyle, GestureResponderEvent, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Props = {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  scaleTo?: number;
  testID?: string;
  accessibilityLabel?: string;
  hapticFeedback?: boolean;
};

/**
 * Touchable button with built-in press scale + opacity animation.
 * Drop-in replacement for TouchableOpacity that feels alive.
 */
export default function PressScale({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  scaleTo = 0.96,
  testID,
  accessibilityLabel,
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleIn = () => {
    scale.value = withSpring(scaleTo, { stiffness: 280, damping: 18 });
    opacity.value = withTiming(0.85, { duration: 90, easing: Easing.out(Easing.quad) });
  };
  const handleOut = () => {
    scale.value = withSpring(1, { stiffness: 220, damping: 14 });
    opacity.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
  };

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={disabled}
      style={style as any}
    >
      <Animated.View style={[animStyle, { flex: 1 }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
