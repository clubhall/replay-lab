import { useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { useReplay } from "../src/replay-store";
import { colors } from "../src/theme";
import {
  Glass,
  IconButton,
  PrimaryButton,
  SectionLabel,
  Tap,
} from "../src/components/ui";
import { Icon } from "../src/components/icon";
import { shareFile, shareTextFile } from "../src/share-file";
import { composition } from "../src/hyperframes";
export default function ShareSheet() {
  const { session } = useReplay();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [style, setStyle] = useState<"original" | "club">("club");
  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await run();
      setMessage(
        Platform.OS === "web" ? "Download ready." : "Share sheet opened.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not share. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 24,
        paddingBottom: 40,
        gap: 22,
        width: "100%",
        maxWidth: 620,
        alignSelf: "center",
      }}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              name="close"
              label="Close sharing"
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <View style={{ alignItems: "center", gap: 12 }}>
        <Glass>
          <View style={{ padding: 20 }}>
            <Icon name="share" size={30} color={colors.gold} />
          </View>
        </Glass>
        <Text
          style={{
            color: colors.text,
            fontSize: 26,
            letterSpacing: -0.7,
            fontWeight: "600",
          }}
        >
          Worth another look.
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 14,
            textAlign: "center",
            lineHeight: 21,
          }}
        >
          Share your recording or take your saved moments into an edit.
        </Text>
      </View>
      <PrimaryButton
        label={busy ? "Preparing…" : "Share original video"}
        icon="share"
        disabled={
          busy || !!session.missing || (!!session.demo && Platform.OS !== "web")
        }
        onPress={() =>
          void act(() =>
            shareFile(
              session.uri,
              session.fileName ?? "clubhall-replay.mp4",
              session.fileName?.toLowerCase().endsWith(".mov")
                ? "video/quicktime"
                : "video/mp4",
            ),
          )
        }
      />
      {session.demo && Platform.OS !== "web" && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Import your own video to share the original file.
        </Text>
      )}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 18,
          gap: 15,
        }}
      >
        <SectionLabel>HYPERFRAMES EDIT</SectionLabel>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "500" }}>
          Your moments, ready to compose.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
          Exports an HTML composition with your trim points. Add your recording
          as source.mp4 in HyperFrames to render the final video.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["original", "club"] as const).map((s) => (
            <Tap
              key={s}
              label={`${s === "club" ? "Club Gold" : "Original"} composition style`}
              selected={style === s}
              onPress={() => setStyle(s)}
              style={{
                backgroundColor: style === s ? colors.gold : colors.raised,
                paddingHorizontal: 16,
                borderRadius: 100,
              }}
            >
              <Text
                style={{ color: style === s ? colors.background : colors.text }}
              >
                {s === "club" ? "Club Gold" : "Original"}
              </Text>
            </Tap>
          ))}
        </View>
        <Tap
          label="Export HyperFrames composition"
          disabled={busy || !session.duration}
          onPress={() =>
            void act(() =>
              shareTextFile(
                composition(session, style),
                "clubhall-composition.html",
                "text/html",
              ),
            )
          }
          style={{ flexDirection: "row", gap: 9 }}
        >
          <Text style={{ color: colors.gold, fontWeight: "600" }}>
            Export composition
          </Text>
          <Icon name="arrow" color={colors.gold} size={17} />
        </Tap>
      </View>
      <Tap
        label="Export moment notes"
        disabled={busy}
        onPress={() =>
          void act(() =>
            shareTextFile(
              JSON.stringify(
                {
                  version: "clubhall-native-replay/v1",
                  title: session.title,
                  duration: session.duration,
                  moments: session.moments,
                },
                null,
                2,
              ),
              "clubhall-moments.json",
              "application/json",
            ),
          )
        }
      >
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Export moment notes
        </Text>
      </Tap>
      {!!message && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.gold, textAlign: "center", fontSize: 13 }}
        >
          {message}
        </Text>
      )}
    </ScrollView>
  );
}
