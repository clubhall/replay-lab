import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplay } from "../src/replay-store";
import { colors, demoPoster, time } from "../src/theme";
import { IconButton, SectionLabel, Tap } from "../src/components/ui";
import { Icon } from "../src/components/icon";
import { ImportButton } from "../src/components/import-button";
export default function CollectionScreen() {
  const { state, select } = useReplay();
  const { bottom } = useSafeAreaInsets();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 24,
        gap: 26,
        paddingBottom: bottom + 30,
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
      }}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              name="close"
              label="Close collection"
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <View style={{ gap: 12 }}>
        <SectionLabel>YOUR GAME, REVISITED</SectionLabel>
        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            letterSpacing: -1,
            fontWeight: "600",
          }}
        >
          A little better.{"\n"}Every replay.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
          Your videos and moments, kept on this device.
        </Text>
      </View>
      <ImportButton full />
      <View style={{ gap: 12 }}>
        {state.sessions.map((session) => (
          <Tap
            key={session.id}
            label={`Open ${session.title}`}
            onPress={() => {
              select(session.id);
              router.back();
            }}
            style={{
              flexDirection: "row",
              padding: 12,
              gap: 16,
              borderRadius: 24,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              justifyContent: "flex-start",
            }}
          >
            <View
              style={{
                width: 90,
                height: 106,
                borderRadius: 15,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.raised,
              }}
            >
              {session.demo ? (
                <Image
                  source={demoPoster}
                  contentFit="cover"
                  contentPosition={{ left: "65%" }}
                  style={{ position: "absolute", inset: 0 }}
                />
              ) : (
                <Icon name="play" color={colors.gold} size={27} />
              )}
            </View>
            <View style={{ flex: 1, gap: 9 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  letterSpacing: 1.5,
                }}
              >
                {session.demo
                  ? "DEMO VIDEO"
                  : new Date(session.createdAt)
                      .toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                      .toUpperCase()}
              </Text>
              <Text
                style={{ color: colors.text, fontSize: 18, fontWeight: "500" }}
              >
                {session.title}
              </Text>
              <Text
                style={{
                  color: session.missing ? colors.danger : colors.muted,
                  fontSize: 12,
                }}
              >
                {session.missing
                  ? "Video needs importing again"
                  : `${time(session.duration)} · ${session.moments.length} saved moments`}
              </Text>
            </View>
            <Icon name="arrow" color={colors.muted} size={18} />
          </Tap>
        ))}
      </View>
    </ScrollView>
  );
}
