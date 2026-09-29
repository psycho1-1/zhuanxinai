'use client';
import { useState } from 'react';

/** 小型教学图与操作区；图示服务于概念，不代替题目的独立条件。 */
export default function LessonVisual({ id }: { id: string }) {
  const [angle, setAngle] = useState(60);
  const [integer, setInteger] = useState(13);
  const [radius, setRadius] = useState(20);
  const svgProps = {
    viewBox: '0 0 440 230',
    role: 'img' as const,
    className: 'lesson-svg',
  };
  if (id === 'number-bases')
    return (
      <div className="lesson-visual">
        <h3>动手探究：把十进制拆成二进制</h3>
        <label>
          选择一个整数：{integer}
          <input
            type="range"
            min="0"
            max="31"
            value={integer}
            onChange={(e) => setInteger(Number(e.target.value))}
          />
        </label>
        <div className="binary-cells">
          {[16, 8, 4, 2, 1].map((weight) => (
            <div key={weight}>
              <strong>{integer & weight ? 1 : 0}</strong>
              <span>× {weight}</span>
            </div>
          ))}
        </div>
        <p>
          {integer} ={' '}
          {[16, 8, 4, 2, 1].filter((w) => integer & w).join(' + ') || '0'}
          。二进制写作 {integer.toString(2)}。
        </p>
        <small>
          试着先写出答案，再移动滑块验证。观察从 7 变成 8 时哪些位发生了进位。
        </small>
      </div>
    );
  if (['angle-measure', 'angle-calculation', 'angles'].includes(id)) {
    const rad = (angle * Math.PI) / 180;
    const x = 200 + 160 * Math.cos(rad),
      y = 190 - 160 * Math.sin(rad);
    return (
      <div className="lesson-visual">
        <h3>拖动滑块，观察角的张开程度</h3>
        <svg
          {...svgProps}
          aria-label={`示意角 AOB 为 ${angle} 度，虚线是角平分线`}
        >
          <path d="M35 190 H410" stroke="#c9d8d2" strokeWidth="1" />
          <path
            d={`M360 190 H200 L${x} ${y}`}
            stroke="#087f62"
            strokeWidth="3"
            fill="none"
          />
          <path
            d={`M245 190 A45 45 0 0 0 ${200 + 45 * Math.cos(rad)} ${190 - 45 * Math.sin(rad)}`}
            stroke="#e09936"
            strokeWidth="3"
            fill="none"
          />
          <path
            d={`M200 190 L${200 + 135 * Math.cos(rad / 2)} ${190 - 135 * Math.sin(rad / 2)}`}
            stroke="#759799"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <text x="187" y="213">
            O
          </text>
          <text x="368" y="194">
            A
          </text>
          <text x={Math.max(10, x - 8)} y={Math.max(18, y - 10)}>
            B
          </text>
          <text x="18" y="24">
            ∠AOB = {angle}°
          </text>
          <text x="18" y="48">
            平分后每个角 {angle / 2}°
          </text>
        </svg>
        <label>
          角度：{angle}°
          <input
            type="range"
            min="10"
            max="170"
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
        </label>
        <p>虚线把角分成相等的两部分。角的大小由张开程度决定。</p>
      </div>
    );
  }
  if (id === 'track-design')
    return (
      <div className="lesson-visual">
        <h3>设计一条简化跑道</h3>
        <svg
          {...svgProps}
          aria-label="两条直道和两个半圆构成的跑道，直道长50米"
        >
          <path
            d="M130 40 H310 A70 70 0 0 1 310 180 H130 A70 70 0 0 1 130 40 Z"
            fill="#edf6f1"
            stroke="#087f62"
            strokeWidth="4"
          />
          <path
            d="M130 110 V40 M130 110 H60"
            stroke="#dc9a35"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <text x="185" y="30">
            直道 50 m
          </text>
          <text x="140" y="100">
            半径 {radius} m
          </text>
          <text x="150" y="220">
            示意图，不按比例绘制
          </text>
        </svg>
        <label>
          设计的弯道半径：{radius} m
          <input
            type="range"
            min="10"
            max="40"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </label>
        <p>
          取 π≈3.14，一圈长约 2×50 + 2×3.14×{radius} ={' '}
          {(100 + 6.28 * radius).toFixed(2)} m。
        </p>
        <small>
          记录两种半径的结果，解释为什么外道要前移起跑点。此模型不用于实际比赛场地验收。
        </small>
      </div>
    );
  if (id === 'nets')
    return (
      <div className="lesson-visual">
        <h3>剪一剪，折一折</h3>
        <svg
          {...svgProps}
          aria-label="一种正方体展开图：四格横排，第二格上下各一格"
        >
          {[
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [3, 1],
            [1, 2],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect
                x={95 + x * 52}
                y={20 + y * 52}
                width="52"
                height="52"
                fill={i === 2 ? '#cce7da' : '#edf6f1'}
                stroke="#087f62"
                strokeWidth="2"
              />
              <text x={117 + x * 52} y={51 + y * 52}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <p>
          沿图形外边缘剪开，沿内部边折叠。以 3
          号面为底面，试着找出与它相对的面。
        </p>
      </div>
    );
  if (['solids', 'points-lines'].includes(id))
    return (
      <div className="lesson-visual">
        <h3>观察面的交线与棱的端点</h3>
        <svg {...svgProps} aria-label="长方体示意图，展示顶点、棱和面">
          <path
            d="M130 75 H260 V190 H130 Z M130 75 L185 25 H315 L260 75 M315 25 V140 L260 190"
            fill="#edf6f1"
            stroke="#087f62"
            strokeWidth="3"
          />
          <path
            d="M130 190 L185 140 H315 M185 140 V25"
            stroke="#81a99a"
            strokeWidth="2"
            strokeDasharray="6 5"
            fill="none"
          />
          <circle cx="130" cy="75" r="5" fill="#e09936" />
          <text x="35" y="67">
            顶点
          </text>
          <text x="170" y="145">
            面
          </text>
          <text x="325" y="90">
            棱
          </text>
        </svg>
        <p>
          长方体有 6 个面、12 条棱、8 个顶点。虚线表示在这个方向被遮挡的棱。
        </p>
      </div>
    );
  if (id === 'views')
    return (
      <div className="lesson-visual">
        <h3>同一个竖直圆柱，三个观察方向</h3>
        <svg
          {...svgProps}
          aria-label="圆柱从正面和左面看为长方形，从上面看为圆"
        >
          <rect
            x="30"
            y="50"
            width="100"
            height="130"
            fill="#edf6f1"
            stroke="#087f62"
            strokeWidth="3"
          />
          <rect
            x="170"
            y="50"
            width="100"
            height="130"
            fill="#edf6f1"
            stroke="#087f62"
            strokeWidth="3"
          />
          <circle
            cx="350"
            cy="110"
            r="50"
            fill="#edf6f1"
            stroke="#087f62"
            strokeWidth="3"
          />
          <text x="57" y="215">
            正面
          </text>
          <text x="196" y="215">
            左面
          </text>
          <text x="326" y="215">
            上面
          </text>
        </svg>
        <p>先确定放置方式和观察方向，再画看到的轮廓。</p>
      </div>
    );
  if (['segments', 'number-line', 'compare-rationals'].includes(id))
    return (
      <div className="lesson-visual">
        <h3>
          {id === 'segments'
            ? '中点把线段分成相等的两段'
            : '在直线上标出点的位置'}
        </h3>
        <svg
          {...svgProps}
          aria-label={
            id === 'segments'
              ? 'A、M、B依次排列，M是线段AB中点'
              : '从负4到正4的数轴，向右为正方向'
          }
        >
          <path d="M40 115 H400" stroke="#087f62" strokeWidth="3" />
          {id === 'segments' ? (
            <>
              {[
                [70, 'A'],
                [220, 'M'],
                [370, 'B'],
              ].map(([x, label]) => (
                <g key={label}>
                  <circle cx={x} cy="115" r="5" fill="#087f62" />
                  <text x={Number(x) - 6} y="148">
                    {label}
                  </text>
                </g>
              ))}
              <text x="113" y="87">
                AM = MB
              </text>
            </>
          ) : (
            <>
              <path
                d="M390 108 L402 115 L390 122"
                fill="none"
                stroke="#087f62"
                strokeWidth="3"
              />
              {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((n) => (
                <g key={n}>
                  <path d={`M${220 + n * 36} 109 V121`} stroke="#087f62" />
                  <text x={214 + n * 36} y="146">
                    {n}
                  </text>
                </g>
              ))}
            </>
          )}
        </svg>
        <p>
          {id === 'segments'
            ? 'M 是中点时，AM = MB = AB ÷ 2。'
            : '原点、正方向和单位长度是数轴的三个要素。'}
        </p>
      </div>
    );
  if (id === 'lines-rays')
    return (
      <div className="lesson-visual">
        <h3>端点与延伸方向</h3>
        <svg
          {...svgProps}
          aria-label="直线向两端延伸；射线有一个端点；线段有两个端点"
        >
          <g stroke="#087f62" strokeWidth="3" fill="none">
            <path d="M80 45 H385 M92 38 L80 45 L92 52 M373 38 L385 45 L373 52" />
            <path d="M85 110 H385 M373 103 L385 110 L373 117" />
            <path d="M85 180 H360" />
          </g>
          <g fill="#087f62">
            <circle cx="85" cy="110" r="5" />
            <circle cx="85" cy="180" r="5" />
            <circle cx="360" cy="180" r="5" />
          </g>
          <text x="12" y="50">
            直线
          </text>
          <text x="12" y="115">
            射线
          </text>
          <text x="12" y="185">
            线段
          </text>
          <text x="79" y="137">
            A
          </text>
          <text x="79" y="207">
            A
          </text>
          <text x="355" y="207">
            B
          </text>
        </svg>
        <p>箭头表示继续延伸，实心点表示端点。直线和射线没有有限的长度。</p>
      </div>
    );
  return null;
}
