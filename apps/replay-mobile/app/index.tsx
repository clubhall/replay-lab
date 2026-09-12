/* eslint-disable react-hooks/immutability -- expo-video exposes a mutable native SharedObject; its documented setters control playback. */
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplay, type Moment } from "../src/replay-store";
import { colors, demoPoster, time } from "../src/theme";
import {
  Glass,
  IconButton,
  PrimaryButton,
  SectionLabel,
  Tap,
} from "../src/components/ui";
import { Icon } from "../src/components/icon";
import { thumbnails } from "../src/thumbnails";
import type { ImageSource } from "expo-image";
import { ImportButton } from "../src/components/import-button";

export default function ReplayScreen() {
  const { ready, session } = useReplay();
  return ready ? (
    <Player key={session.id} />
  ) : (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator
        color={colors.gold}
        accessibilityLabel="Loading your collection"
      />
    </View>
  );
}
function Player() {
  const { session, update, error, clearError } = useReplay();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const view = useRef<VideoView>(null);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fit, setFit] = useState(!session.demo);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<"chapters" | "saved">(
    session.moments.length ? "saved" : "chapters",
  );
  const [active, setActive] = useState<Moment | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [frames, setFrames] = useState<ImageSource[]>([]);
  const previousCount = useRef(session.moments.length);
  const [duration, setDuration] = useState(session.duration);
  const player = useVideoPlayer(session.missing ? null : session.uri, (p) => {
    p.muted = true;
    p.timeUpdateEventInterval = 0.1;
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  useFocusEffect(
    useCallback(
      () => () => {
        player.pause();
      },
      [player],
    ),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    const loaded = player.addListener("sourceLoad", (event) => {
      if (event.duration > 0) {
        setDuration(event.duration);
        if (Math.abs(event.duration - session.duration) > 0.15)
          update(session.id, { duration: event.duration });
      }
    });
    return () => {
      subscription.remove();
      loaded.remove();
    };
  }, [player, session.duration, session.id, update]);
  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    player.loop = loop && !active;
  }, [player, loop, active]);
  useEffect(() => {
    if (
      active &&
      isPlaying &&
      scrub === null &&
      currentTime >= active.end - 0.08
    ) {
      if (loop) player.currentTime = active.start;
      else if (!active.id.startsWith("chapter")) {
        player.pause();
        player.currentTime = active.end;
      }
    }
  }, [currentTime, active, loop, isPlaying, player, scrub]);
  useEffect(() => {
    if (session.moments.length > previousCount.current) {
      setTab("saved");
      setActive(session.moments[session.moments.length - 1]);
    }
    previousCount.current = session.moments.length;
    if (active && !active.id.startsWith("chapter")) {
      const fresh = session.moments.find((m) => m.id === active.id);
      if (fresh !== active) setActive(fresh ?? null);
    }
  }, [session.moments, active]);
  const pauseAndOpen = (
    route: "/moment" | "/session" | "/share" | "/collection",
    params: Record<string, string> = {},
  ) => {
    player.pause();
    router.push({ pathname: route, params });
  };
  const play = () => {
    setStarted(true);
    if (isPlaying) player.pause();
    else {
      if (active && currentTime >= active.end - 0.15)
        player.currentTime = active.start;
      else if (currentTime >= duration - 0.1) player.currentTime = 0;
      player.play();
    }
  };
  const jump = (moment: Moment) => {
    setActive(moment);
    setStarted(true);
    player.currentTime = moment.start;
    player.play();
  };
  const chapters: Moment[] = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) => ({
        id: `chapter-${i}`,
        title: ["Opening", "In motion", "Follow through"][i],
        start: (duration * i) / 3,
        end: (duration * (i + 1)) / 3,
        note: "",
        shot: "",
      })),
    [duration],
  );
  const moments = tab === "saved" ? session.moments : chapters;
  useEffect(() => {
    if (status !== "readyToPlay") return;
    let alive = true;
    void thumbnails(
      player,
      session.uri,
      moments.map((m) => m.start),
    )
      .then((images) => {
        if (alive) setFrames(images as ImageSource[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [player, status, moments, session.uri]);
  const isWide = width >= 900;
  const cardHeight = isWide
    ? Math.min(height - 175, 710)
    : Math.max(320, Math.min(height * 0.49, 470));
  const unavailable = status === "error" || session.missing;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: "Replay",
          headerTitleAlign: "center",
          headerLeft: () => (
            <IconButton
              name="collection"
              label="Open collection"
              onPress={() => pauseAndOpen("/collection")}
            />
          ),
          headerRight: () => <ImportButton />,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: isWide ? 40 : 16,
          paddingTop: 14,
          paddingBottom: insets.bottom + 20,
          maxWidth: 1250,
          width: "100%",
          alignSelf: "center",
          gap: 24,
        }}
      >
        <View
          style={{
            flexDirection: isWide ? "row" : "column",
            gap: isWide ? 36 : 24,
          }}
        >
          <View style={{ flex: isWide ? 1.5 : undefined, gap: 15 }}>
            <View
              style={{
                height: cardHeight,
                borderRadius: 30,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: "#090C0B",
              }}
            >
              <VideoView
                ref={view}
                player={player}
                style={{ position: "absolute", inset: 0 }}
                contentFit={fit ? "contain" : "cover"}
                nativeControls={false}
                playsInline
                fullscreenOptions={{ enable: true }}
                allowsPictureInPicture
              />
              {!started && session.demo && (
                <Image
                  source={demoPoster}
                  contentFit="cover"
                  contentPosition={{ left: "64%", top: "50%" }}
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
              <LinearGradient
                pointerEvents="none"
                colors={["#050A0855", "#050A0800", "#050A0800", "#050A08F0"]}
                locations={[0, 0.3, 0.5, 1]}
                style={{ position: "absolute", inset: 0 }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 18,
                  left: 18,
                  right: 18,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Glass>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                    }}
                  >
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 5,
                        backgroundColor: colors.gold,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 1.6,
                      }}
                    >
                      {session.demo ? "DEMO SESSION" : "ON YOUR DEVICE"}
                    </Text>
                  </View>
                </Glass>
                <IconButton
                  name="more"
                  label="Session details"
                  glass
                  onPress={() => pauseAndOpen("/session")}
                />
              </View>
              <View
                style={{
                  position: "absolute",
                  top: "36%",
                  alignSelf: "center",
                }}
              >
                {unavailable ? (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 20,
                      padding: 18,
                      gap: 8,
                      maxWidth: 280,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 17,
                        fontWeight: "600",
                      }}
                    >
                      Video unavailable
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {session.missing
                        ? "Import this video again to review it."
                        : "Check your connection, then reopen this session."}
                    </Text>
                  </View>
                ) : status === "loading" ? (
                  <ActivityIndicator
                    color={colors.text}
                    size="large"
                    accessibilityLabel="Loading video"
                  />
                ) : (
                  <Glass>
                    <Tap
                      label={isPlaying ? "Pause video" : "Play video"}
                      onPress={play}
                      style={{ width: 72, height: 72 }}
                    >
                      <Icon name={isPlaying ? "pause" : "play"} size={28} />
                    </Tap>
                  </Glass>
                )}
              </View>
              <View
                style={{
                  position: "absolute",
                  left: 22,
                  right: 22,
                  bottom: 20,
                  gap: 12,
                }}
              >
                <View style={{ gap: 5 }}>
                  <SectionLabel>TENNIS / REPLAY</SectionLabel>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: isWide ? 38 : 29,
                      letterSpacing: -0.9,
                      fontWeight: "600",
                      color: colors.text,
                    }}
                  >
                    {session.title}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: "#CDD2C8",
                      fontSize: 12,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {time(scrub ?? currentTime)}{" "}
                    <Text style={{ color: "#FFFFFF65" }}>
                      {" "}
                      / {time(duration)}
                    </Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Tap
                      label={fit ? "Fill video frame" : "Show full video frame"}
                      onPress={() => setFit(!fit)}
                      style={{ paddingHorizontal: 6 }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {fit ? "FIT" : "FILL"}
                      </Text>
                    </Tap>
                    <IconButton
                      name={muted ? "muted" : "sound"}
                      label={muted ? "Unmute video" : "Mute video"}
                      onPress={() => setMuted(!muted)}
                    />
                    <IconButton
                      name="expand"
                      label="Open fullscreen"
                      onPress={() => {
                        setStarted(true);
                        void view.current?.enterFullscreen();
                      }}
                    />
                  </View>
                </View>
                <Slider
                  accessibilityLabel="Video position"
                  minimumValue={0}
                  maximumValue={Math.max(duration, 1)}
                  value={scrub ?? currentTime}
                  minimumTrackTintColor={colors.gold}
                  maximumTrackTintColor="#FFFFFF44"
                  thumbTintColor={colors.gold}
                  onSlidingStart={(value) => setScrub(value)}
                  onValueChange={(value) => setScrub(value)}
                  onSlidingComplete={(value) => {
                    player.currentTime = value;
                    setScrub(null);
                  }}
                  style={{ height: 20, marginHorizontal: -2 }}
                />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Glass>
                <Tap
                  label={`Playback speed ${rate}×`}
                  onPress={() =>
                    setRate(rate === 1 ? 0.5 : rate === 0.5 ? 0.25 : 1)
                  }
                  selected={rate !== 1}
                  style={{
                    flexDirection: "row",
                    gap: 9,
                    paddingHorizontal: 20,
                    height: 48,
                  }}
                >
                  <Icon
                    name="slow"
                    color={rate !== 1 ? colors.gold : colors.muted}
                    size={21}
                  />
                  <Text
                    style={{
                      color: rate !== 1 ? colors.gold : colors.text,
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {rate}×
                  </Text>
                </Tap>
              </Glass>
              <Glass>
                <Tap
                  label={loop ? "Turn loop off" : "Loop playback"}
                  onPress={() => setLoop(!loop)}
                  selected={loop}
                  style={{
                    flexDirection: "row",
                    gap: 9,
                    paddingHorizontal: 20,
                    height: 48,
                  }}
                >
                  <Icon
                    name="loop"
                    color={loop ? colors.gold : colors.muted}
                    size={20}
                  />
                  <Text
                    style={{
                      color: loop ? colors.gold : colors.text,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    Loop
                  </Text>
                </Tap>
              </Glass>
              <Glass>
                <IconButton
                  name="share"
                  label="Share session"
                  onPress={() => pauseAndOpen("/share")}
                  size={48}
                />
              </Glass>
            </View>
          </View>
          <View
            style={{
              flex: isWide ? 1 : undefined,
              justifyContent: isWide ? "center" : undefined,
              gap: 20,
            }}
          >
            {isWide && (
              <View style={{ gap: 10, marginBottom: 16 }}>
                <SectionLabel>CLUBHALL / ON COURT</SectionLabel>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 44,
                    fontWeight: "500",
                    letterSpacing: -1.6,
                  }}
                >
                  A closer look{"\n"}at your game.
                </Text>
                <Text
                  style={{ color: colors.muted, lineHeight: 23, fontSize: 15 }}
                >
                  Find the moment. Slow it down. Make it yours.
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 23,
                  fontWeight: "600",
                  letterSpacing: -0.6,
                }}
              >
                Your moments
                <Text
                  style={{
                    color: colors.muted,
                    fontWeight: "400",
                    fontSize: 16,
                  }}
                >
                  {" "}
                  {session.moments.length.toString().padStart(2, "0")}
                </Text>
              </Text>
              <Tap
                label={tab === "saved" ? "Show chapters" : "Show saved moments"}
                onPress={() => setTab(tab === "saved" ? "chapters" : "saved")}
                style={{ paddingLeft: 12 }}
              >
                <Text
                  style={{
                    color: colors.gold,
                    fontSize: 13,
                    fontWeight: "500",
                  }}
                >
                  {tab === "saved" ? "Chapters" : "Saved"}
                </Text>
              </Tap>
            </View>
            {moments.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {moments.map((moment, i) => (
                  <View
                    key={moment.id}
                    style={{ width: isWide ? 124 : (width - 54) / 3, gap: 6 }}
                  >
                    <Tap
                      label={`Play ${moment.title}`}
                      selected={active?.id === moment.id}
                      onPress={() => jump(moment)}
                      style={{
                        width: "100%",
                        aspectRatio: 1.22,
                        borderRadius: 17,
                        borderCurve: "continuous",
                        overflow: "hidden",
                        backgroundColor: colors.raised,
                        borderWidth: active?.id === moment.id ? 2 : 0,
                        borderColor: colors.gold,
                      }}
                    >
                      {frames[i] || session.demo ? (
                        <Image
                          source={frames[i] ?? demoPoster}
                          contentFit="cover"
                          contentPosition={{ left: "60%", top: "50%" }}
                          style={{
                            position: "absolute",
                            inset: 0,
                            opacity: 0.75,
                          }}
                        />
                      ) : (
                        <Icon name="play" color={colors.muted} />
                      )}
                      <LinearGradient
                        colors={["transparent", "#00000099"]}
                        style={{ position: "absolute", inset: 0 }}
                      />
                      <Text
                        style={{
                          position: "absolute",
                          left: 9,
                          bottom: 8,
                          fontSize: 11,
                          fontWeight: "600",
                          color: colors.text,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {time(moment.start)}
                      </Text>
                      {tab === "saved" && (
                        <View
                          style={{ position: "absolute", right: 8, top: 8 }}
                        >
                          <Icon name="saved" color={colors.gold} size={14} />
                        </View>
                      )}
                    </Tap>
                    {tab === "saved" ? (
                      <Tap
                        label={`Edit ${moment.title}`}
                        onPress={() =>
                          pauseAndOpen("/moment", { id: moment.id })
                        }
                        style={{ alignItems: "flex-start", minHeight: 36 }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.text,
                            fontSize: 12,
                            fontWeight: "500",
                          }}
                        >
                          {moment.title}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontSize: 10,
                            marginTop: 3,
                          }}
                        >
                          Edit moment
                        </Text>
                      </Tap>
                    ) : (
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.muted, fontSize: 11 }}
                      >
                        {moment.title}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 20,
                  padding: 20,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "500",
                  }}
                >
                  Keep the part worth replaying.
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}
                >
                  Pause anywhere and save your first moment.
                </Text>
              </View>
            )}
            <PrimaryButton
              icon="bookmark"
              label="Save a moment"
              disabled={!!unavailable || !duration}
              onPress={() =>
                pauseAndOpen("/moment", { at: String(player.currentTime) })
              }
            />
            <Text
              style={{
                color: colors.muted,
                textAlign: "center",
                fontSize: 11,
                lineHeight: 17,
              }}
            >
              {tab === "chapters"
                ? "Chapters divide your video by time. You choose the highlights."
                : "Your moments are saved privately on this device."}
            </Text>
          </View>
        </View>
        {error && (
          <Tap
            label="Dismiss storage message"
            onPress={clearError}
            style={{
              padding: 16,
              backgroundColor: colors.surface,
              borderRadius: 16,
            }}
          >
            <Text style={{ color: colors.danger }}>{error}</Text>
          </Tap>
        )}
      </ScrollView>
    </View>
  );
}
