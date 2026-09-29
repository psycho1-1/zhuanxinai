// 对齐人教版2024七上；文字、例题与练习为本站原创。
export const upperLessons = [
  {
    id: 'signed-numbers',
    chapterId: 'rational',
    section: '1.1',
    title: '正数、负数与零',
    concept:
      '正数和负数表示具有相反意义的量。0 既不是正数也不是负数。先约定正方向，再用符号表示；允许偏差表示实际值与标准值的差。',
    example:
      '规定收入为正，支出 12 元记作 −12 元；标准长度 20 cm，偏差 −0.2 cm，实际长 19.8 cm。',
    hint: '先说清楚以什么为标准，什么方向规定为正。',
    minutes: 10,
  },
  {
    id: 'rational-types',
    chapterId: 'rational',
    section: '1.2.1',
    title: '有理数的概念与分类',
    concept:
      '整数和分数统称有理数。整数包括正整数、0、负整数；有限小数和无限循环小数都能化为分数。分类时同一层采用同一个标准，不重复、不遗漏。',
    example: '−3 是负整数，0 是整数，0.25 = 1/4 是正分数。',
    hint: '0 属于整数；能化成两个整数之比的数是有理数。',
    minutes: 10,
  },
  {
    id: 'compare-rationals',
    chapterId: 'rational',
    section: '1.2.5',
    title: '有理数的大小比较',
    concept:
      '正数大于 0，负数小于 0。两个负数比较时，绝对值大的反而小。在数轴上，右边的数总比左边大。',
    example: '−2 > −5，因为 −2 更靠近 0；−1/3 > −1/2。',
    hint: '负数比较不要只比数字大小，想一想数轴位置。',
    minutes: 10,
  },
  {
    id: 'addition',
    chapterId: 'arithmetic',
    section: '2.1.1',
    title: '有理数加法与运算律',
    concept:
      '同号相加，取相同符号并把绝对值相加；异号相加，取绝对值较大数的符号，再用较大绝对值减较小绝对值。加法交换律、结合律仍成立。',
    example: '−7 + 3 = −4；−18 + 7 + 18 = (−18 + 18) + 7 = 7。',
    hint: '先判断同号还是异号，巧算时优先凑整或凑零。',
    minutes: 10,
  },
  {
    id: 'subtraction',
    chapterId: 'arithmetic',
    section: '2.1.2',
    title: '有理数减法与加减混合',
    concept:
      '减去一个数等于加上这个数的相反数：a − b = a + (−b)。加减混合可统一为加法，但移动一个数时要连同它前面的符号。',
    example: '−2 − (−6) = −2 + 6 = 4。',
    hint: '变的是减号后那个数的符号，前面的数不变。',
    minutes: 10,
  },
  {
    id: 'multiplication',
    chapterId: 'arithmetic',
    section: '2.2.1',
    title: '有理数乘法与运算律',
    concept:
      '两数相乘，同号得正、异号得负，再乘绝对值；任何数乘 0 都得 0。多个非零数相乘，负因数个数为奇数则积为负。交换律、结合律、分配律仍成立。',
    example: '(−4)×(−3)×(−2)=−24；(−3)×(2−5)=−6+15=9。',
    hint: '先数负因数的个数，再算绝对值。',
    minutes: 10,
  },
  {
    id: 'division',
    chapterId: 'arithmetic',
    section: '2.2.2',
    title: '倒数与有理数除法',
    concept:
      '乘积为 1 的两个数互为倒数，0 没有倒数。除以一个非零数等于乘这个数的倒数。0 可以作被除数，不能作除数。',
    example: '−2/3 的倒数是 −3/2；6 ÷ (−3/4) = 6 × (−4/3) = −8。',
    hint: '求倒数时交换分子分母，保留符号。',
    minutes: 10,
  },
  {
    id: 'powers',
    chapterId: 'arithmetic',
    section: '2.3.1',
    title: '有理数的乘方',
    concept:
      '求 n 个相同因数 a 的积叫乘方，结果叫幂，a 是底数，n 是指数。负数的偶次幂为正、奇次幂为负。−a² 表示 a² 的相反数，与 (−a)² 不同。',
    example: '(−3)² = 9，而 −3² = −9；(−2)³ = −8。',
    hint: '先确定底数是否连同负号一起放进括号。',
    minutes: 10,
  },
  {
    id: 'power-mixed',
    chapterId: 'arithmetic',
    section: '2.3.1 · 综合',
    title: '含乘方的混合运算',
    concept:
      '先算乘方，再算乘除，最后算加减；有括号先算括号内，同级从左到右。绝对值要先化为对应的非负数。',
    example: '−2² + 3×(−1) = −4−3=−7。',
    hint: '标出乘方、括号和乘除，再逐层计算。',
    minutes: 10,
  },
  {
    id: 'scientific',
    chapterId: 'arithmetic',
    section: '2.3.2',
    title: '科学记数法',
    concept:
      '把大于 10 的数写成 a×10ⁿ，其中 1≤a<10，n 是正整数。小数点向左移动几位，指数就是几。位数为 k 的正整数，其指数为 k−1。',
    example: '720000 = 7.2×10⁵；3.04×10⁴ = 30400。',
    hint: '先把系数调整到 1 至 10 之间，再数移动位数。',
    minutes: 10,
  },
  {
    id: 'rounding',
    chapterId: 'arithmetic',
    section: '2.3.3',
    title: '近似数与精确度',
    concept:
      '近似数是接近准确值的数。用四舍五入取近似值时，看保留位的下一位；精确到哪一位由最后保留的数位决定，末尾的 0 有意义。',
    example: '3.146 精确到百分位为 3.15；2.30 精确到百分位，2.3 精确到十分位。',
    hint: '先标出要保留的位，再看它右边一位。',
    minutes: 10,
  },
  {
    id: 'number-bases',
    chapterId: 'arithmetic',
    section: '综合与实践',
    title: '进位制的认识与探究',
    concept:
      '十进制逢十进一，各位的权依次是 1、10、100。二进制只用 0、1，逢二进一，位权依次是 1、2、4、8。活动：用 13 枚棋子每两枚打包一次，记录各层剩余数，解释 13 的二进制写法。',
    example: '十进制 23 = 2×10+3；二进制 1011 表示 1×8+0×4+1×2+1=11。',
    hint: '从右边起，各位的权每向左一位乘进制数。',
    minutes: 10,
  },
  {
    id: 'algebra-model',
    chapterId: 'expressions',
    section: '3.1',
    title: '列代数式表示数量关系',
    concept:
      '用数字、字母和运算符号表示数量关系。数与字母相乘常省略乘号，数字写前面；除法通常写成分数形式，和或差的倍数要加括号。',
    example: '每本书 a 元，买 3 本再付 2 元运费，费用为 3a+2。',
    hint: '先用语言说清数量关系，再把未知数量换成字母。',
    minutes: 10,
  },
  {
    id: 'monomials',
    chapterId: 'algebra',
    section: '4.1',
    title: '单项式的系数与次数',
    concept:
      '数字或字母的积叫单项式，单独一个数或字母也是单项式。数字因数是系数，各字母指数的和是次数。π 是常数，不计入字母指数。',
    example: '−3x²y 的系数为 −3，次数为 2+1=3；−a 的系数为 −1。',
    hint: '系数要带符号；次数把所有字母的指数相加。',
    minutes: 10,
  },
  {
    id: 'polynomials',
    chapterId: 'algebra',
    section: '4.1',
    title: '多项式与整式',
    concept:
      '几个单项式的和叫多项式，每个单项式是它的项，不含字母的项是常数项。次数最高项的次数就是多项式的次数。单项式和多项式统称整式。',
    example: '2x²−3x+7 是二次三项式，常数项为 7，二次项的系数为 2。',
    hint: '拆项时连同前面的正负号一起看。',
    minutes: 10,
  },
  {
    id: 'remove-brackets',
    chapterId: 'algebra',
    section: '4.2',
    title: '去括号法则',
    concept:
      '括号前是加号，去括号后各项符号不变；括号前是减号，去括号后各项都变号。有数字因数时，用分配律乘到括号内每一项。',
    example: '−2(a−3b)=−2a+6b。',
    hint: '不要只改第一项，检查括号内每一项的符号。',
    minutes: 10,
  },
  {
    id: 'polynomial-sum',
    chapterId: 'algebra',
    section: '4.2',
    title: '整式的加减与化简求值',
    concept:
      '整式加减通常先去括号，再合并同类项。化简求值要先化简再代入，减少计算。可用电子表格把不同字母取值和结果列成表，观察规律。',
    example: '(2a+3b)−(a−b)=a+4b；a=2，b=−1 时值为 −2。',
    hint: '每一步保留符号，只有同类项能合并。',
    minutes: 10,
  },
  {
    id: 'equation-concept',
    chapterId: 'equation',
    section: '5.1.1',
    title: '方程与方程的解',
    concept:
      '含有未知数的等式叫方程。使等式左右两边相等的未知数的值叫方程的解。只含一个未知数、未知数次数为 1、两边都是整式的方程是一元一次方程。',
    example: 'x=3 是 2x+1=7 的解，因为 2×3+1=7。',
    hint: '判断一元一次方程，要同时检查等号、未知数个数和次数。',
    minutes: 10,
  },
  {
    id: 'equality',
    chapterId: 'equation',
    section: '5.1.2',
    title: '等式的性质',
    concept:
      '等式两边加减同一个数或式子，结果仍相等；两边乘同一个数，或除以同一个非零数，结果仍相等。移项的依据是等式两边做相同运算。',
    example: 'x−3=5，两边加 3 得 x=8。不能随意把等式两边同时除以 0。',
    hint: '操作必须左右一致；除法还要检查除数不为 0。',
    minutes: 10,
  },
  {
    id: 'equation-brackets',
    chapterId: 'equation',
    section: '5.2',
    title: '解方程：去括号与移项',
    concept:
      '先用分配律去括号，再把含未知数的项移到一边、常数移到另一边，合并后把系数化为 1。移项要变号，去括号要乘到每一项。',
    example: '2(x−1)=x+5 → 2x−2=x+5 → x=7。',
    hint: '按去括号、移项、合并、系数化为 1 的顺序检查。',
    minutes: 10,
  },
  {
    id: 'equation-fractions',
    chapterId: 'equation',
    section: '5.2',
    title: '解方程：去分母',
    concept:
      '用各分母的最小公倍数乘等式两边的每一项，去分母后再按步骤求解。分子是多项式时先加括号，不能漏乘没有分母的项。',
    example: '(x−1)/2 + x/3 = 2，两边乘 6 得 3(x−1)+2x=12，解得 x=3。',
    hint: '圈出等式的每一项，逐项乘最小公倍数。',
    minutes: 10,
  },
  {
    id: 'applications-sales',
    chapterId: 'equation',
    section: '5.3',
    title: '方程应用：销售与配套',
    concept:
      '利润=售价−成本，利润率=利润÷成本。折扣以标价为基数。配套问题按每套需求列数量关系，分配人数还要满足总人数不变。',
    example: '成本 80 元，利润率 25%，售价为 80×1.25=100 元。',
    hint: '利润率看成本，折扣看标价；配套先写每套需要的比例。',
    minutes: 10,
  },
  {
    id: 'applications-travel',
    chapterId: 'equation',
    section: '5.3',
    title: '方程应用：行程问题',
    concept:
      '路程=速度×时间。相向而行的两人，相遇时路程之和等于起初距离；同向追及时，路程之差等于起初间距。注意统一时间和速度单位。',
    example:
      '两人相距 30 km，速度分别为 4、6 km/h，相向同时出发，相遇时间满足 (4+6)t=30，t=3 h。',
    hint: '先画示意图，标出出发点、方向和间距。',
    minutes: 10,
  },
  {
    id: 'applications-work',
    chapterId: 'equation',
    section: '5.3',
    title: '方程应用：工程与总量',
    concept:
      '把一项工程总量看作 1，工作效率=1÷单独完成时间。合作效率相加，完成量=效率×时间。列方程时区分已完成部分和剩余部分。',
    example:
      '甲单独 6 天，乙单独 3 天完成，合作效率为 1/6+1/3=1/2，合作 2 天完成。',
    hint: '先设总量为 1，再写每个人每天完成的分数。',
    minutes: 10,
  },
  {
    id: 'solids',
    chapterId: 'geometry',
    section: '6.1.1',
    title: '立体图形与平面图形',
    concept:
      '平面图形在一个平面内，立体图形占据空间。常见立体包括棱柱、棱锥、圆柱、圆锥、球。观察时可从面、棱、顶点和曲面辨认。',
    example: '纸上的三角形是平面图形；长方体有 6 个面、12 条棱和 8 个顶点。',
    hint: '先判断是否占据空间，再观察面的形状。',
    minutes: 10,
  },
  {
    id: 'nets',
    chapterId: 'geometry',
    section: '6.1.1 · 展开',
    title: '立体图形的展开图',
    concept:
      '沿部分棱剪开立体表面，可以得到平面展开图。判断能否折成立体，要看面能否正确相接且不重叠。圆柱侧面沿母线展开是长方形，圆锥侧面展开是扇形。',
    example:
      '制作活动：剪出 6 个同样的正方形，尝试组成一个正方体展开图，折叠检验面是否重叠。',
    hint: '想象或实际折叠；有 6 个正方形不一定就能折成正方体。',
    minutes: 10,
  },
  {
    id: 'views',
    chapterId: 'geometry',
    section: '6.1.1 · 观察',
    title: '从不同方向观察图形',
    concept:
      '从正面、左面、上面观察同一立体，可能得到不同平面形状。主视方向要先确定；观察图要同时考虑遮挡关系。',
    example:
      '竖直放置的圆柱，从上面看是圆，从正面看是长方形。活动：摆 3 个小方块，从三个方向画出看到的轮廓。',
    hint: '先站定观察方向，再看轮廓，不把被挡住的边随意画出来。',
    minutes: 10,
  },
  {
    id: 'points-lines',
    chapterId: 'geometry',
    section: '6.1.2',
    title: '点、线、面、体',
    concept:
      '体由面围成，面与面相交成线，线与线相交成点。点没有大小，线没有粗细。运动可帮助理解：点动成线、线动成面、面动成体。',
    example: '笔尖移动留下线的轨迹；长方形绕一条边旋转一周形成圆柱。',
    hint: '把静态图形与运动轨迹联系起来。',
    minutes: 10,
  },
  {
    id: 'lines-rays',
    chapterId: 'geometry',
    section: '6.2.1',
    title: '直线、射线与线段',
    concept:
      '直线向两端无限延伸，没有端点；射线有一个端点，向一端无限延伸；线段有两个端点，长度有限。两点确定一条直线，两点之间线段最短。射线命名先写端点。',
    example:
      '直线 AB 与 BA 是同一直线；射线 AB 与 BA 的端点不同，一般不是同一条射线。',
    hint: '先数端点，再判断是否能测量长度。',
    minutes: 10,
  },
  {
    id: 'angle-measure',
    chapterId: 'geometry',
    section: '6.3.1',
    title: '角的概念与度量',
    concept:
      '有公共端点的两条射线组成角，公共端点叫顶点。角的大小由两边张开的程度决定，与所画边长无关。1°=60′，1′=60″。量角器的中心对顶点、零刻度线对一边。',
    example: '30°30′ = 30.5°；1.25° = 1°15′。',
    hint: '度分秒是六十进制，不能按小数的十进制换算。',
    minutes: 10,
  },
  {
    id: 'angle-calculation',
    chapterId: 'geometry',
    section: '6.3.2',
    title: '角的比较、运算与平分线',
    concept:
      '比较角可用叠合法或度量法。角相加或相减时，要先确认射线的位置。角平分线从顶点出发，把角分成两个相等的角。时钟上每一大格对应 30°。',
    example: 'OB 在 ∠AOC 内，∠AOB=25°、∠BOC=35°，则 ∠AOC=60°。',
    hint: '先判断射线在角内还是角外，避免不看图就相加。',
    minutes: 10,
  },
  {
    id: 'track-design',
    chapterId: 'geometry',
    section: '综合与实践',
    title: '设计田径运动会比赛场地',
    concept:
      '把场地拆成两条等长直道和两个半圆弯道。两个半圆合成一个圆，所以一圈长为 2L+2πr。活动：量取或设计 L、r，在方格纸画出示意图；讨论外道为何要前移起跑点。这里只建立简化模型，实际比赛按场地标准测量。',
    example:
      '取 π≈3.14，直道 L=50 m、半径 r=20 m，一圈约为 100+125.6=225.6 m。',
    hint: '两条直道别漏一条，两个半圆的弧长合起来算整圆。',
    minutes: 10,
  },
] as const;
