import { useState } from "react";
import { ActivityIndicator, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useReplay } from "../replay-store";
import { IconButton, PrimaryButton } from "./ui";
import { colors } from "../theme";
export function ImportButton({ full = false }: { full?: boolean }) {
  const { importVideo, ready } = useReplay();
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    if (busy || !ready) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      setBusy(true);
      const asset = result.assets[0];
      await importVideo(
        asset.uri,
        asset.fileName ?? "New session",
        (asset.duration ?? 0) / 1000,
      );
      router.dismissAll();
      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Check your storage and try again.";
      if (Platform.OS === "web")
        window.alert(`Couldn’t import video. ${message}`);
      else Alert.alert("Couldn’t import video", message);
    } finally {
      setBusy(false);
    }
  };
  if (full)
    return (
      <PrimaryButton
        icon="plus"
        label={busy ? "Saving your video…" : "Import a video"}
        onPress={() => void choose()}
        disabled={busy || !ready}
      />
    );
  return busy ? (
    <ActivityIndicator color={colors.gold} style={{ width: 44 }} />
  ) : (
    <IconButton
      name="plus"
      label="Import a video"
      onPress={() => void choose()}
      color={colors.gold}
    />
  );
}
