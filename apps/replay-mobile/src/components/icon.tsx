import { Platform } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";
const icons = {
  play: ["play.fill", "m9 5 11 7-11 7Z"],
  pause: ["pause.fill", "M8 5v14M16 5v14"],
  plus: ["plus", "M12 5v14M5 12h14"],
  back: ["chevron.left", "m15 5-7 7 7 7"],
  close: ["xmark", "m6 6 12 12M6 18 18 6"],
  check: ["checkmark", "m5 12 4 4L19 6"],
  bookmark: ["bookmark", "M6 4h12v17l-6-4-6 4Z"],
  saved: ["bookmark.fill", "M6 4h12v17l-6-4-6 4Z"],
  collection: ["square.stack", "M7 3h10M5 6h14M3 9h18v12H3Z"],
  expand: [
    "arrow.up.left.and.arrow.down.right",
    "M9 3H3v6M3 3l7 7m5 11h6v-6m0 6-7-7",
  ],
  loop: ["repeat", "M4 8h15l-3-3m3 3-3 3M20 16H5l3 3m-3-3 3-3"],
  share: ["square.and.arrow.up", "M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"],
  more: ["ellipsis", "M5 12h.01M12 12h.01M19 12h.01"],
  slow: ["tortoise", "M5 15c0-10 14-10 14 0ZM7 15v3m10-3v3M2 12l3 2m14-2 3-2"],
  photo: ["photo.on.rectangle", "M4 4h16v16H4Zm0 12 5-5 4 4 3-3 4 4M8 8h.01"],
  edit: [
    "slider.horizontal.3",
    "M3 6h5m4 0h9M3 12h11m4 0h3M3 18h2m4 0h12M8 3v6m6 0v6M5 15v6",
  ],
  trash: ["trash", "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"],
  arrow: ["arrow.up.right", "M6 18 18 6M6 6h12v12"],
  sound: ["speaker.wave.2", "M3 9h4l5-4v14l-5-4H3ZM16 8q5 4 0 8m3-11q8 7 0 14"],
  muted: ["speaker.slash", "M3 9h4l5-4v14l-5-4H3ZM17 9l5 6m0-6-5 6"],
  undo: ["arrow.uturn.backward", "M9 4 3 10l6 6M3 10h11a6 6 0 0 1 0 12"],
  heart: ["heart", "M12 21 3 12C-3 4 7 0 12 7c5-7 15-3 9 5Z"],
} as const;
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  if (Platform.OS === "ios")
    return (
      <Image
        source={`sf:${icons[name][0]}`}
        tintColor={color}
        style={{ width: size, height: size }}
      />
    );
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" || name === "saved" ? color : "none"}
    >
      <Path
        d={icons[name][1]}
        stroke={color}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
