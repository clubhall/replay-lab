import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { useReplay } from "../src/replay-store";
import { colors, time } from "../src/theme";
import {
  IconButton,
  PrimaryButton,
  SectionLabel,
  Tap,
} from "../src/components/ui";
export default function SessionSheet() {
  const { session, update, deleteSession } = useReplay();
  const [title, setTitle] = useState(session.title);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 24,
        paddingBottom: 40,
        gap: 24,
        maxWidth: 620,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              name="close"
              label="Close session details"
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <View style={{ gap: 10 }}>
        <SectionLabel>SESSION NAME</SectionLabel>
        <TextInput
          accessibilityLabel="Session name"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 17,
            fontSize: 20,
            color: colors.text,
          }}
        />
      </View>
      <View
        style={{
          backgroundColor: colors.surface,
          padding: 20,
          borderRadius: 20,
          gap: 18,
        }}
      >
        {[
          ["Duration", time(session.duration)],
          ["Saved moments", String(session.moments.length)],
          ["Storage", session.demo ? "Included demo" : "On this device"],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.muted }}>{label}</Text>
            <Text style={{ color: colors.text }}>{value}</Text>
          </View>
        ))}
      </View>
      <PrimaryButton
        label="Save session"
        icon="check"
        disabled={!title.trim()}
        onPress={() => {
          update(session.id, { title: title.trim() });
          router.back();
        }}
      />
      {session.demo ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
          Demo footage from Pexels. Import your own recording to start your
          collection. Chapters are time markers; Replay doesn’t automatically
          identify shots.
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {confirm && (
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              Remove this saved copy and its moments? The original in your photo
              library stays available.
            </Text>
          )}
          <Tap
            label={confirm ? "Confirm remove session" : "Remove session"}
            onPress={() => {
              if (!confirm) {
                setConfirm(true);
                return;
              }
              void deleteSession(session.id)
                .then(() => router.back())
                .catch(() =>
                  setError("Could not remove the session. Please try again."),
                );
            }}
          >
            <Text style={{ color: colors.danger }}>
              {confirm ? "Remove from Replay" : "Remove session"}
            </Text>
          </Tap>
          {confirm && (
            <Tap label="Cancel removal" onPress={() => setConfirm(false)}>
              <Text style={{ color: colors.text }}>Keep session</Text>
            </Tap>
          )}
        </View>
      )}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}
