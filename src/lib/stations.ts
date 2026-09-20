export type Station = {
  id: string;
  name: string;
  tag: string;
  url: string;
};

export const STATIONS: Station[] = [
  {
    id: "groove",
    name: "Groove Salad",
    tag: "SomaFM · downtempo",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
  {
    id: "drone",
    name: "Drone Zone",
    tag: "SomaFM · ambient",
    url: "https://ice2.somafm.com/dronezone-128-mp3",
  },
  {
    id: "defcon",
    name: "DEF CON Radio",
    tag: "SomaFM · electronica",
    url: "https://ice4.somafm.com/defcon-128-mp3",
  },
  {
    id: "lush",
    name: "Lush",
    tag: "SomaFM · mellow",
    url: "https://ice6.somafm.com/lush-128-mp3",
  },
  {
    id: "paradise",
    name: "Radio Paradise",
    tag: "Eclectic mix",
    url: "https://stream.radioparadise.com/mp3-128",
  },
  {
    id: "nightride",
    name: "Nightride FM",
    tag: "Synthwave",
    url: "https://stream.nightride.fm/nightride.mp3",
  },
  {
    id: "kexp",
    name: "KEXP",
    tag: "Seattle live",
    url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
  },
  {
    id: "deepspace",
    name: "Deep Space One",
    tag: "SomaFM · space",
    url: "https://ice1.somafm.com/deepspaceone-128-mp3",
  },
];

export function proxyStreamUrl(raw: string) {
  return `/api/stream?url=${encodeURIComponent(raw)}`;
}
