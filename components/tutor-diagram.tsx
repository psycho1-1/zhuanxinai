/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG geometry needs an accessible image role; an img cannot contain these shapes. */
import type { TutorDiagram as Diagram } from '@/lib/course-tutor-contract';
export default function TutorDiagram({ diagram }: { diagram: Diagram }) {
  if (diagram.type === 'steps')
    return (
      <figure className="ct-diagram">
        <figcaption>{diagram.title}</figcaption>
        <ol>
          {diagram.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </figure>
    );
  const p = diagram.point,
    range = Math.max(6, Math.ceil(Math.abs(p)) + 1);
  const x = (n: number) => 180 + (n * 150) / range;
  return (
    <figure className="ct-diagram">
      <figcaption>{diagram.title}</figcaption>
      <svg
        viewBox="0 0 360 165"
        role="img"
        aria-label={`数轴上点${p}到原点的距离是${Math.abs(p)}`}
      >
        <path
          d="M18 96H343 M334 90L343 96L334 102"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        {Array.from({ length: range * 2 + 1 }, (_, i) => i - range).map((n) => (
          <g key={n}>
            <path d={`M${x(n)} 91v10`} stroke="currentColor" />
            <text x={x(n)} y="120" textAnchor="middle">
              {n}
            </text>
          </g>
        ))}
        <path
          d={`M${x(p)} 82V58H180V82`}
          fill="none"
          stroke="#cf872e"
          strokeWidth="2"
        />
        <circle cx={x(p)} cy="96" r="5" fill="#0e7557" />
        <circle cx="180" cy="96" r="4" fill="#cf872e" />
        <text x={(x(p) + 180) / 2} y="43" textAnchor="middle">
          距离 {Math.abs(p)}
        </text>
        <text x="180" y="149" textAnchor="middle">
          |{p}| = {Math.abs(p)} · 距离非负
        </text>
      </svg>
    </figure>
  );
}
