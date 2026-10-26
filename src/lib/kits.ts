// Club kit colours for avatars. Patterns are drawn on the shirt; colours are evocations, never logos.

export type KitPattern = "solid" | "stripes" | "hoops" | "halves" | "sash" | "band";
export interface Kit { shirt: string; alt: string; pattern: KitPattern; trim: string; shorts: string; socks: string }

const k = (shirt: string, shorts: string, pattern: KitPattern = "solid", alt = shirt, trim = shorts, socks = shirt): Kit =>
  ({ shirt, alt, pattern, trim, shorts, socks });

const W = "#f4f4f2", B = "#121212", RED = "#d71920", NAVY = "#14244d", SKY = "#6cabdd", YEL = "#f7d117", GRN = "#0b7a3b", BLU = "#1f4fb4", CLA = "#7a263a";

/** Ordered: the first keyword found in the normalised club name wins, so specific names come first. */
const KITS: [string[], Kit][] = [
  [["jong ajax", "ajax"], k(W, W, "band", RED, RED, W)],
  [["espanyol"], k(W, BLU, "stripes", BLU, BLU, BLU)],
  [["barcelon", "barca"], k("#a50044", "#004d98", "stripes", "#004d98", "#edbb00", "#a50044")],
  [["real madrid"], k(W, W, "solid", W, "#c9a227", W)],
  [["mineiro"], k(W, B, "stripes", B, B, W)],
  [["river plate"], k(W, B, "sash", RED, RED, W)],
  [["atletico madrid", "atletico de madrid"], k(W, NAVY, "stripes", "#cb3524", "#cb3524", "#cb3524")],
  [["athletic"], k(W, B, "stripes", "#ee2523", B, B)],
  [["betis"], k(W, W, "stripes", "#0bb363", "#0bb363", "#0bb363")],
  [["sevilla", "seville"], k(W, W, "solid", W, RED, W)],
  [["valence", "valencia"], k(W, B, "solid", W, "#ee7e00", B)],
  [["villarreal"], k("#ffe667", "#ffe667", "solid", "#ffe667", "#005187")],
  [["real sociedad"], k(W, W, "stripes", "#0067b1", "#0067b1", "#0067b1")],
  [["celta"], k("#8ac3ee", W, "solid", "#8ac3ee", RED)],
  [["getafe"], k("#005999", "#005999")],
  [["rayo vallecano"], k(W, W, "sash", RED, RED, W)],
  [["deportivo la coruna", "deportivo lc"], k(W, BLU, "stripes", BLU, BLU, W)],
  [["malaga"], k(W, BLU, "stripes", "#5aa9e6", BLU, W)],
  [["levante"], k("#004b91", "#004b91", "stripes", "#b4053f")],
  [["girona"], k(W, BLU, "stripes", RED, RED, RED)],
  [["osasuna"], k("#d91a21", NAVY)],
  [["manchester city", "man city"], k(SKY, W, "solid", SKY, NAVY, SKY)],
  [["manchester united", "man utd", "man united"], k("#da291c", W, "solid", "#da291c", B, B)],
  [["liverpool"], k("#c8102e", "#c8102e", "solid", "#c8102e", W)],
  [["arsenal"], k("#ef0107", W, "solid", "#ef0107", W, W)],
  [["chelsea"], k("#034694", "#034694", "solid", "#034694", W, W)],
  [["tottenham", "spurs"], k(W, "#132257", "solid", W, "#132257", W)],
  [["newcastle"], k(W, B, "stripes", B, B, B)],
  [["west ham"], k(CLA, W, "solid", CLA, "#1bb1e7", CLA)],
  [["aston villa"], k("#670e36", W, "solid", "#670e36", "#95bfe5", "#95bfe5")],
  [["everton"], k("#003399", W, "solid", "#003399", W, W)],
  [["nottingham"], k("#dd0000", W, "solid", "#dd0000", W, RED)],
  [["brighton"], k(W, NAVY, "stripes", "#0057b8", "#0057b8", W)],
  [["watford"], k("#fbee23", B, "solid", "#fbee23", RED, "#fbee23")],
  [["leicester"], k("#003090", W, "solid", "#003090", "#fdbe11", "#003090")],
  [["bournemouth"], k(B, B, "stripes", "#da291c", "#da291c", B)],
  [["fulham"], k(W, B, "solid", W, B, W)],
  [["crystal palace"], k("#1b458f", "#1b458f", "stripes", "#c4122e", "#c4122e", "#1b458f")],
  [["reading"], k(W, NAVY, "hoops", "#004494", "#004494", W)],
  [["norwich"], k("#fff200", GRN, "solid", "#fff200", GRN, "#fff200")],
  [["swansea"], k(W, W, "solid", W, B)],
  [["wolverhampton", "wolves"], k("#fdb913", B, "solid", "#fdb913", B, "#fdb913")],
  [["burnley"], k(CLA, W, "solid", CLA, "#99d6ea", CLA)],
  [["hull"], k("#f5a12d", B, "stripes", B, B, "#f5a12d")],
  [["blackburn"], k(W, W, "halves", "#009ee0", "#009ee0", W)],
  [["qp rangers", "queens park"], k(W, W, "hoops", "#1d5ba4", "#1d5ba4", W)],
  [["leeds"], k(W, W, "solid", W, "#1d428a", W)],
  [["stoke"], k(W, W, "stripes", "#e03a3e", "#e03a3e", W)],
  [["southampton", "sunderland", "brentford"], k(W, B, "stripes", RED, B, RED)],
  [["sheffield wednesday"], k(W, B, "stripes", "#0e00f7", B, W)],
  [["bristol city", "aberdeen"], k(RED, W, "solid", RED, W, RED)],
  [["birmingham", "cardiff"], k("#1f4fb4", W, "solid", "#1f4fb4", W, "#1f4fb4")],
  [["celtic"], k(W, W, "hoops", "#018749", "#018749", W)],
  [["rangers"], k("#1b458f", W, "solid", "#1b458f", RED, B)],
  [["paris", "psg"], k("#004170", "#004170", "band", "#da291c", W, "#004170")],
  [["marseille"], k(W, W, "solid", W, "#2faee0", W)],
  [["lyon"], k(W, W, "sash", "#1e4fa0", "#da291c", W)],
  [["monaco"], k(W, W, "halves", "#e51b22", "#e51b22", W)],
  [["lille"], k("#e01e13", NAVY, "solid", "#e01e13", W, "#e01e13")],
  [[" nice "], k(B, B, "stripes", RED, RED, B)],
  [[" lens "], k("#ffd700", B, "stripes", "#e30613", "#e30613", "#ffd700")],
  [["nantes"], k("#fcd405", "#fcd405", "solid", "#fcd405", GRN, "#fcd405")],
  [["saint-etienne", "saint etienne"], k("#009639", W, "solid", "#009639", W, "#009639")],
  [["toulouse"], k("#5b2a86", W, "solid", "#5b2a86", W, "#5b2a86")],
  [["metz"], k("#7a1e3b", "#7a1e3b")],
  [["angers"], k(W, B, "stripes", B, B, B)],
  [["rennes", "reims", "brest"], k(RED, B, "solid", RED, W, RED)],
  [["bordeaux"], k(NAVY, W, "band", W, W, NAVY)],
  [["strasbourg", "auxerre"], k("#009fe3", W, "solid", "#009fe3", W, "#009fe3")],
  [["lorient", "montpellier"], k("#f58025", NAVY, "solid", "#f58025", NAVY, "#f58025")],
  [["bayern"], k("#dc052d", "#dc052d", "solid", "#dc052d", W, "#dc052d")],
  [["dortmund", "bvb"], k("#fde100", B, "solid", "#fde100", B, "#fde100")],
  [["leverkusen"], k(B, B, "solid", B, "#e32221", "#e32221")],
  [["leipzig", "salzburg", "salzbourg"], k(W, W, "solid", W, "#dd0741", W)],
  [["wolfsburg"], k("#65b32e", W, "solid", "#65b32e", W, "#65b32e")],
  [["nuremberg", "nurnberg"], k("#8a1538", B, "solid", "#8a1538", W, "#8a1538")],
  [["schalke", "hoffenheim"], k("#004d9d", W, "solid", "#004d9d", W, "#004d9d")],
  [["frankfurt"], k(B, B, "solid", B, RED, B)],
  [["gladbach", "werder", "breme"], k(W, GRN, "solid", W, GRN, W)],
  [["stuttgart", "koln", "cologne", "hamburg", "hambourg"], k(W, W, "band", RED, RED, W)],
  [["hertha"], k(W, BLU, "stripes", BLU, BLU, BLU)],
  [["freiburg", "union berlin", "mainz", "twente", "az alkmaar", "standard", "kashima", "urawa", "internacional", "al ahly", "toronto", "spartak", "benfica"], k(RED, W, "solid", RED, W, RED)],
  [["juventus", "ascoli", "udinese", "besiktas", "botafogo"], k(W, B, "stripes", B, B, B)],
  [["inter milan", "internazionale", "inter "], k("#0068a8", B, "stripes", B, B, B)],
  [["milan"], k(B, W, "stripes", "#fb090b", W, B)],
  [[" roma "], k("#8e1f2f", W, "solid", "#8e1f2f", "#f0bc42", B)],
  [["lazio", "napoli", "naples", "malmo", "zenit", "zenith"], k(SKY, W, "solid", SKY, W, SKY)],
  [["sampdoria"], k("#1b5497", W, "band", W, RED, "#1b5497")],
  [["empoli", "cruzeiro", "cruz azul", "gantoise", " gent ", "genk", "al-hilal", "al hilal", "dynamo moscou", "dynamo moscow"], k("#0b4ea2", W, "solid", "#0b4ea2", W, "#0b4ea2")],
  [["chievo", "verone", "verona"], k("#ffd200", "#003d7c", "solid", "#ffd200", "#003d7c", "#003d7c")],
  [["palermo", "cerezo", "inter miami"], k("#f19cbb", B, "solid", "#f19cbb", B, B)],
  [["fiorentina", "sanfrecce", "anderlecht"], k("#4f2582", W, "solid", "#4f2582", W, "#4f2582")],
  [["atalanta", "bruges", "brugge", "gamba"], k(B, B, "stripes", "#1e71b8", "#1e71b8", B)],
  [["torino"], k(CLA, W, "solid", CLA, W, B)],
  [["genoa", "cagliari", "tokyo"], k(RED, NAVY, "halves", NAVY, W, NAVY)],
  [["bologna"], k(RED, W, "stripes", NAVY, NAVY, NAVY)],
  [["gremio"], k("#0d80bf", B, "stripes", B, B, W)],
  [["porto", "monterrey", "pachuca"], k(W, NAVY, "stripes", "#0047ab", "#0047ab", NAVY)],
  [["sporting"], k(W, B, "hoops", "#008057", "#008057", "#008057")],
  [["braga"], k("#d71920", W, "solid", "#d71920", W, W)],
  [["psv", "etoile rouge", "red star", "guadalajara", "chivas", "stade de reims"], k(W, W, "stripes", RED, RED, RED)],
  [["feyenoord"], k(W, B, "halves", RED, B, B)],
  [["fenerbahce"], k("#ffed00", W, "stripes", "#002d72", "#002d72", "#002d72")],
  [["galatasaray"], k("#a90432", W, "halves", "#fdb912", "#fdb912", "#a90432")],
  [["trabzon"], k(CLA, W, "stripes", "#6aa9e2", "#6aa9e2", CLA)],
  [["dynamo kiev", "dynamo kyiv", "santos", "corinthians"], k(W, B, "solid", W, "#0047ab", W)],
  [["chakhtar", "shakhtar"], k("#f37021", B, "stripes", B, B, "#f37021")],
  [["krasnodar", "palmeiras"], k("#006437", W, "solid", "#006437", W, "#006437")],
  [["cska"], k(RED, BLU, "halves", BLU, BLU, RED)],
  [[" aik ", "columbus", "crew"], k("#fedd00", B, "solid", "#fedd00", B, "#fedd00")],
  [["flamengo", " atlas ", "atlanta"], k(RED, W, "hoops", B, B, RED)],
  [["fluminense"], k("#870a28", W, "stripes", "#00613c", "#00613c", W)],
  [["sao paulo", "vasco"], k(W, W, "sash", B, RED, W)],
  [["boca"], k("#103f79", "#103f79", "band", "#f3b229", "#f3b229", "#103f79")],
  [["america", "tigres", "vegalta", "al nassr", "al-nassr"], k("#ffd400", NAVY, "solid", "#ffd400", NAVY, "#ffd400")],
  [["ittihad"], k("#ffd400", B, "stripes", B, B, B)],
  [["albirex"], k("#ff6a13", "#ff6a13", "solid", "#ff6a13", "#1d5aa8")],
  [["yokohama", "kawasaki"], k("#2a8bd6", W, "solid", "#2a8bd6", W, "#2a8bd6")],
];

/** Kit everyone owns: black with a hot-pink sash. */
export const GOALMASTER_KIT: Kit = k("#111111", "#111111", "sash", "#ff2d87", "#ff2d87", "#ff2d87");

const FALLBACK: Kit[] = [
  k(RED, W, "solid", RED, W, RED), k(BLU, W, "solid", BLU, W, BLU), k(W, B, "stripes", B, B, B), k(GRN, W, "stripes", W, W, GRN),
  k(YEL, NAVY, "solid", YEL, NAVY, YEL), k(NAVY, W, "hoops", SKY, SKY, NAVY), k(CLA, W, "solid", CLA, SKY, CLA), k("#f58025", B, "halves", B, B, "#f58025"),
  k(W, RED, "sash", RED, RED, W), k("#5b2a86", W, "stripes", W, W, "#5b2a86"), k(SKY, NAVY, "solid", SKY, NAVY, SKY), k(B, B, "band", YEL, YEL, B),
];

export function normalizeClub(club: string): string {
  return ` ${club.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function kitFor(club: string | null | undefined): Kit {
  if (!club) return GOALMASTER_KIT;
  const n = normalizeClub(club);
  for (const [keys, kit] of KITS) if (keys.some((key) => n.includes(key))) return kit;
  return FALLBACK[hash(n) % FALLBACK.length];
}

/** Readable print colour (name, number) over a shirt colour. */
export function inkOn(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#141414" : "#ffffff";
}
