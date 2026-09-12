import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReplayProvider } from "../src/replay-store";
import { colors } from "../src/theme";
export default function Layout() {
  return (
    <ReplayProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Replay" }} />
        <Stack.Screen
          name="collection"
          options={{ title: "Your collection", presentation: "modal" }}
        />
        <Stack.Screen
          name="moment"
          options={{
            title: "Save moment",
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="session"
          options={{
            title: "Session details",
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.65, 1],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="share"
          options={{
            title: "Share session",
            presentation: "formSheet",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.5, 1],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
    </ReplayProvider>
  );
}
