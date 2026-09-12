import { useState, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from "expo-glass-effect";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors } from "../theme";
import { Icon, type IconName } from "./icon";
export function haptic() {
  if (Platform.OS === "ios") void Haptics.selectionAsync().catch(() => {});
}
export function Glass({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles: StyleProp<ViewStyle> = [
    { borderRadius: 100, overflow: "hidden", borderCurve: "continuous" },
    style,
  ];
  if (
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  )
    return (
      <GlassView isInteractive style={styles}>
        {children}
      </GlassView>
    );
  return (
    <BlurView
      tint="systemThinMaterialDark"
      intensity={65}
      style={[
        {
          backgroundColor: "#292D2999",
          borderWidth: 1,
          borderColor: "#FFFFFF16",
        },
        styles,
      ]}
    >
      {children}
    </BlurView>
  );
}
export function Tap({
  children,
  onPress,
  label,
  style,
  disabled,
  selected,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, selected }}
        testID={testID}
        disabled={disabled}
        onPress={() => {
          haptic();
          onPress();
        }}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 5,
          }).start()
        }
        style={[
          {
            minHeight: 44,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
  size = 44,
  glass = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  glass?: boolean;
}) {
  const button = (
    <Tap label={label} onPress={onPress} style={{ width: size, height: size }}>
      <Icon name={name} color={color} />
    </Tap>
  );
  return glass ? <Glass>{button}</Glass> : button;
}
export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Tap
      label={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: 56,
        borderRadius: 100,
        backgroundColor: colors.gold,
        flexDirection: "row",
        gap: 9,
        paddingHorizontal: 24,
      }}
    >
      {icon && <Icon name={icon} color={colors.background} size={20} />}
      <Text
        style={{ fontSize: 16, fontWeight: "600", color: colors.background }}
      >
        {label}
      </Text>
    </Tap>
  );
}
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 2,
      }}
    >
      {children}
    </Text>
  );
}
export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}
