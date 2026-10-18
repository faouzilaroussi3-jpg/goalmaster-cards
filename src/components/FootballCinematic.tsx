import { openingCinematic } from "@/lib/opening-cinematic";

export function FootballCinematic({ cards }: { cards: ReadonlyArray<{ tier: number }> }) {
  const { tier, action } = openingCinematic(cards);
  return (
    <div className="football-cinematic" data-tier={tier} data-action={action} role="img" aria-label="Silhouette d’un footballeur en action">
      <div className="cinema-floodlights" />
      <div className="cinema-speed-lines" />
      <svg className="cinema-scene" viewBox="0 0 960 600" aria-hidden="true">
        <defs>
          <pattern id="goal-net" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="1" /></pattern>
        </defs>
        <g className="cinema-stadium">
          <path d="M0 480Q480 435 960 480M0 520H960M360 600L430 470M690 600L600 470" />
          <path d="M740 260H915V478H740Z" fill="url(#goal-net)" />
          <path d="M740 478V260H915V478" strokeWidth="5" />
        </g>
        <ellipse className="cinema-ground-shadow" cx="460" cy="480" rx="105" ry="15" />
        <g className="cinema-player-travel">
          <g className="cinema-player">
            <g className="cinema-arm-back"><path d="M-8-104Q-38-117-55-90L-82-55Q-88-44-78-39L-67-48-36-72-5-65Z" /></g>
            <g className="cinema-leg-back"><path d="M-22-12L-39 40-77 72Q-83 82-69 86L-49 75-10 51 11 4Z" /><path d="M-76 71L-87 80-102 81Q-110 89-100 93L-70 91-64 80Z" /></g>
            <path d="M-17-123Q5-137 29-114L38-57 24-5-26-4-39-49Z" />
            <path d="M-27-11L24-10 30 17 4 24-13 13-34 15Z" />
            <path d="M-7-125L-5-143 13-145 18-123Z" />
            <path d="M-13-159Q-11-180 6-179Q24-178 26-161L31-152 24-148Q23-134 11-134L-4-138Z" />
            <g className="cinema-arm-front"><path d="M19-116Q38-118 47-92L61-68 96-76Q108-78 110-67L95-60 58-47Q45-44 37-60L17-88Z" /></g>
            <g className="cinema-leg-front"><path d="M10 4L36 43 70 54 65 73 20 63Q12 60 7 51L-15 17Z" /><path d="M65 54L79 59 91 57Q101 61 96 69L65 79 58 71Z" /></g>
          </g>
        </g>
        <g className="cinema-ball-travel">
          <g className="cinema-ball"><circle r="17" /><path d="M0-8L8-2 5 8H-5L-8-2ZM0-8L-3-16M8-2L16-5M5 8L10 14M-5 8L-10 14M-8-2L-16-5" /></g>
        </g>
        <g className="cinema-impact"><circle cx="830" cy="365" r="36" /><circle cx="830" cy="365" r="64" /></g>
        {tier >= 5 && <g className="cinema-sparks">{Array.from({ length: tier >= 7 ? 32 : 18 }, (_, i) => <path key={i} d="M830 365l-12-4 8-3Z" transform={`rotate(${i * 360 / (tier >= 7 ? 32 : 18)} 830 365) translate(${55 + i % 4 * 20} 0)`} />)}</g>}
      </svg>
      <div className="cinema-impact-wash" />
    </div>
  );
}