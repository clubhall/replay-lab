import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import Slider from "@react-native-community/slider";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, demoPoster, time } from "../src/theme";
import { useReplay, makeId } from "../src/replay-store";
import {
  IconButton,
  PrimaryButton,
  SectionLabel,
  Tap,
} from "../src/components/ui";
import { Icon } from "../src/components/icon";

export default function MomentSheet() {
  const { session, update } = useReplay();
  const { id, at } = useLocalSearchParams<{ id?: string; at?: string }>();
  const [saved] = useState(() => session.moments.find((m) => m.id === id));
  const position = Math.max(0, Math.min(Number(at) || 0, session.duration));
  const [title, setTitle] = useState(
    saved?.title ?? `Moment ${session.moments.length + 1}`,
  );
  const [start, setStart] = useState(
    saved?.start ?? Math.max(0, Math.min(position - 2, session.duration - 1)),
  );
  const [end, setEnd] = useState(
    saved?.end ?? Math.min(session.duration, Math.max(position + 3, 1)),
  );
  const [shot, setShot] = useState(saved?.shot ?? "");
  const [note, setNote] = useState(saved?.note ?? "");
  const [removed, setRemoved] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const valid =
    title.trim().length > 0 &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end <= session.duration &&
    end - start >= 0.25;
  const save = () => {
    if (!valid) return;
    const moment = {
      id: saved?.id ?? makeId(),
      title: title.trim(),
      start,
      end,
      shot,
      note: note.trim(),
    };
    update(session.id, {
      moments: saved
        ? session.moments.map((m) => (m.id === saved.id ? moment : m))
        : [...session.moments, moment],
    });
    router.back();
  };
  if (removed)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          backgroundColor: colors.background,
          gap: 22,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.text, fontSize: 24 }}>Moment removed</Text>
        <PrimaryButton
          label="Undo removal"
          onPress={() => {
            if (saved)
              update(session.id, { moments: [...session.moments, saved] });
            setRemoved(false);
          }}
        />
        <Tap label="Done" onPress={() => router.back()}>
          <Text style={{ color: colors.muted }}>Done</Text>
        </Tap>
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          title: saved ? "Edit moment" : "Save moment",
          headerRight: () => (
            <IconButton
              name="close"
              label="Cancel editing"
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 24,
          paddingBottom: bottom + 28,
          gap: 24,
          width: "100%",
          maxWidth: 620,
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 90,
              height: 90,
              borderRadius: 20,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {session.demo ? (
              <Image
                source={demoPoster}
                style={{ width: 90, height: 90 }}
                contentFit="cover"
              />
            ) : (
              <Icon name="bookmark" color={colors.gold} size={30} />
            )}
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <SectionLabel>MAKE IT YOURS</SectionLabel>
            <Text
              style={{
                color: colors.text,
                fontSize: 23,
                fontWeight: "600",
                letterSpacing: -0.5,
              }}
            >
              {time(start)} — {time(end)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {(end - start).toFixed(1)} seconds · {session.title}
            </Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <SectionLabel>MOMENT NAME</SectionLabel>
          <TextInput
            accessibilityLabel="Moment name"
            value={title}
            onChangeText={setTitle}
            maxLength={64}
            selectTextOnFocus
            placeholder="Give this moment a name"
            placeholderTextColor={colors.muted}
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              fontSize: 17,
            }}
          />
        </View>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 18,
            gap: 14,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.text, fontWeight: "500" }}>
              Trim your moment
            </Text>
            <Text style={{ color: colors.gold, fontSize: 12 }}>In / Out</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontVariant: ["tabular-nums"],
              }}
            >
              Start {start.toFixed(1)}s
            </Text>
            <Slider
              accessibilityLabel="Moment start"
              value={start}
              step={0.1}
              minimumValue={0}
              maximumValue={Math.max(0, end - 0.3)}
              onValueChange={setStart}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.gold}
              style={{ height: 36 }}
            />
          </View>
          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontVariant: ["tabular-nums"],
              }}
            >
              End {end.toFixed(1)}s
            </Text>
            <Slider
              accessibilityLabel="Moment end"
              value={end}
              step={0.1}
              minimumValue={Math.min(session.duration, start + 0.3)}
              maximumValue={session.duration}
              onValueChange={setEnd}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.gold}
              style={{ height: 36 }}
            />
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <SectionLabel>ADD A TAG</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["Forehand", "Backhand", "Serve", "Volley", "Footwork"].map(
              (tag) => (
                <Tap
                  key={tag}
                  label={`Tag ${tag}`}
                  selected={shot === tag}
                  onPress={() => setShot(shot === tag ? "" : tag)}
                  style={{
                    borderRadius: 99,
                    paddingHorizontal: 15,
                    backgroundColor:
                      shot === tag ? colors.gold : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: shot === tag ? colors.background : colors.text,
                      fontSize: 13,
                    }}
                  >
                    {tag}
                  </Text>
                </Tap>
              ),
            )}
          </View>
        </View>
        <TextInput
          accessibilityLabel="Moment note"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder="What did you notice? Add a private note…"
          placeholderTextColor={colors.muted}
          style={{
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            minHeight: 90,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            textAlignVertical: "top",
          }}
        />
        <PrimaryButton
          label={saved ? "Save changes" : "Keep this moment"}
          icon="check"
          onPress={save}
          disabled={!valid}
        />
        {saved && (
          <Tap
            label="Delete moment"
            onPress={() => {
              update(session.id, {
                moments: session.moments.filter((m) => m.id !== saved.id),
              });
              setRemoved(true);
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 14 }}>
              Delete moment
            </Text>
          </Tap>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
