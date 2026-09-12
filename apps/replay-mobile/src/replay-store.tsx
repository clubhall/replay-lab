import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoSource } from "./theme";
import { resolveMedia, saveMedia, removeMedia } from "./media-storage";

export type Moment = {
  id: string;
  title: string;
  start: number;
  end: number;
  note: string;
  shot: string;
};
export type Session = {
  id: string;
  title: string;
  uri: string;
  duration: number;
  fileName?: string;
  createdAt: string;
  moments: Moment[];
  demo?: boolean;
  missing?: boolean;
};
type State = { sessions: Session[]; selected: string };
const initial: State = {
  selected: "demo",
  sessions: [
    {
      id: "demo",
      title: "Baseline practice",
      uri: demoSource,
      duration: 11.8,
      createdAt: "",
      demo: true,
      moments: [],
    },
  ],
};
const KEY = "clubhall-replay-ios-v1";
export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const Context = createContext<{
  state: State;
  session: Session;
  ready: boolean;
  error: string | null;
  select: (id: string) => void;
  update: (id: string, change: Partial<Session>) => void;
  importVideo: (uri: string, name: string, duration: number) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearError: () => void;
} | null>(null);
export function ReplayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as State;
          if (
            !Array.isArray(parsed.sessions) ||
            !parsed.sessions.some((s) => s.id === "demo")
          )
            throw new Error("Invalid collection");
          const sessions = await Promise.all(
            parsed.sessions.map(async (s) => {
              if (s.demo) return { ...s, uri: demoSource };
              const uri = await resolveMedia(s.id, s.uri);
              return { ...s, uri: uri ?? s.uri, missing: !uri };
            }),
          );
          if (alive)
            setState({
              sessions,
              selected: sessions.some((s) => s.id === parsed.selected)
                ? parsed.selected
                : "demo",
            });
        }
      } catch {
        if (alive)
          setError(
            "Your saved collection could not be loaded. Try reopening Replay before importing another video.",
          );
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  // Serialize durable writes so a slower prior save can never replace a newer edit.
  const loaded = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(state)))
      .catch(() =>
        setError(
          "This change could not be saved. Check available storage before closing Replay.",
        ),
      );
  }, [state, ready]);
  const update = useCallback(
    (id: string, change: Partial<Session>) =>
      setState((s) => ({
        ...s,
        sessions: s.sessions.map((v) =>
          v.id === id ? { ...v, ...change } : v,
        ),
      })),
    [],
  );
  return (
    <Context.Provider
      value={{
        state,
        ready,
        error,
        clearError: () => setError(null),
        session:
          state.sessions.find((s) => s.id === state.selected) ??
          state.sessions[0],
        select: (id) => setState((s) => ({ ...s, selected: id })),
        update,
        importVideo: async (uri, name, duration) => {
          const id = makeId();
          const local = await saveMedia(id, uri);
          setState((s) => ({
            selected: id,
            sessions: [
              {
                id,
                title: name.replace(/\.[^.]+$/, "") || "Untitled session",
                fileName: name,
                uri: local,
                duration: duration || 0,
                createdAt: new Date().toISOString(),
                moments: [],
              },
              ...s.sessions,
            ],
          }));
        },
        deleteSession: async (id) => {
          const session = state.sessions.find((s) => s.id === id);
          if (!session || session.demo) return;
          await removeMedia(id, session.uri);
          setState((s) => ({
            selected: s.selected === id ? "demo" : s.selected,
            sessions: s.sessions.filter((v) => v.id !== id),
          }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReplay() {
  const value = useContext(Context);
  if (!value) throw new Error("ReplayProvider is missing");
  return value;
}
