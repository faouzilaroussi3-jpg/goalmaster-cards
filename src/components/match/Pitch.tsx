/** Turf, lines and goals of a 105 x 68 m pitch, drawn in metres inside a viewBox of -3 -3 111 74. */
export function PitchMarkings() {
  const W = 105, H = 68;
  return (
    <>
      <rect x={-3} y={-3} width={W + 6} height={H + 6} className="mm-turf-edge" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={(i * W) / 10} y={0} width={W / 10} height={H} className={i % 2 ? "mm-turf-a" : "mm-turf-b"} />
      ))}
      <g className="mm-lines" fill="none">
        <rect x={0} y={0} width={W} height={H} />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
        <circle cx={W / 2} cy={H / 2} r={9.15} />
        <circle cx={W / 2} cy={H / 2} r={0.4} className="mm-spot" />
        <rect x={0} y={H / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={W - 16.5} y={H / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={0} y={H / 2 - 9.16} width={5.5} height={18.32} />
        <rect x={W - 5.5} y={H / 2 - 9.16} width={5.5} height={18.32} />
        <path d={`M16.5 ${H / 2 - 7.3} A9.15 9.15 0 0 1 16.5 ${H / 2 + 7.3}`} />
        <path d={`M${W - 16.5} ${H / 2 - 7.3} A9.15 9.15 0 0 0 ${W - 16.5} ${H / 2 + 7.3}`} />
        <circle cx={11} cy={H / 2} r={0.4} className="mm-spot" />
        <circle cx={W - 11} cy={H / 2} r={0.4} className="mm-spot" />
      </g>
      <rect x={-2} y={H / 2 - 3.66} width={2} height={7.32} className="mm-goal" />
      <rect x={W} y={H / 2 - 3.66} width={2} height={7.32} className="mm-goal" />
    </>
  );
}
