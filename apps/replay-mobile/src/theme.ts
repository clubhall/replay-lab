import { Asset } from "expo-asset";
import videoAsset from "../assets/tennis-demo.mp4";
import posterAsset from "../assets/tennis-poster.jpg";
export const colors = {
  background: "#101312",
  surface: "#1D211F",
  raised: "#292E2A",
  line: "#343B34",
  text: "#F6F6EE",
  muted: "#9CA69D",
  gold: "#E6CB87",
  green: "#C7D7AD",
  danger: "#FFA8A0",
};
export const time = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
export const demoSource = Asset.fromModule(videoAsset).uri;
export const demoPoster = posterAsset;
