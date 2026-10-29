import { yuan } from "./finance.js";
                                       
/** Published statistics shown beside events and choices. Every figure keeps its source, year and scope.
 * Probabilities that use these figures are game settings and say so; a national rate is never presented
 * as the player's personal odds. */
                         
              
                    
               
 
export const sources = {
  nbsIncome2025: {
    label: ["国家统计局《2025年居民收入和消费支出情况》", "NBS China, household income and consumption 2025"],
    published: "2026-01-19",
    url: "https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html",
  },
  nbsWage2025: {
    label: ["国家统计局《2025年城镇单位就业人员年平均工资情况》", "NBS China, average wages of urban employees 2025"],
    published: "2026-05-15",
    url: "https://www.stats.gov.cn/sj/zxfbhjd/202605/t20260515_1963706.html",
  },
  nbsJobs2025: {
    label: ["国家统计局 2025 年国民经济运行解读", "NBS China, 2025 economic review"],
    published: "2026-01-19",
    url: "https://www.stats.gov.cn/sj/sjjd/202601/t20260119_1962339.html",
  },
  nhcHealth2024: {
    label: ["国家卫健委《2024年我国卫生健康事业发展统计公报》", "NHC China, health statistics bulletin 2024"],
    published: "2025-12-02",
    url: "https://www.news.cn/politics/20251202/c879035250804e9995ccb8d284656f67/c.html",
  },
  mcaBulletin2024: {
    label: ["民政部《2024年民政事业发展统计公报》", "Ministry of Civil Affairs, statistical bulletin 2024"],
    published: "2025-07-30",
  },
  mpsVehicles2024: {
    label: ["公安部 2024 年全国机动车保有量统计", "Ministry of Public Security, vehicles 2024"],
    published: "2025-01-17",
  },
  lpr: {
    label: ["全国银行间同业拆借中心 贷款市场报价利率", "National Interbank Funding Center, Loan Prime Rate"],
    published: "2026-10-20",
  },
  iit: {
    label: ["《个人所得税法》及专项附加扣除标准（2023 年 8 月起）", "PRC IIT Law and special deductions (from Aug 2023)"],
    published: "2023-08-31",
  },
}                                 ;
                                            
                       
             
                   
 
export const facts = {
  income2025: {
    text: [
      "2025 年全国居民人均可支配收入 43,377 元，中位数 36,231 元；城镇居民中位数 51,115 元，农村 20,711 元。",
      "In 2025 China's per-capita disposable income averaged ¥43,377 with a median of ¥36,231; urban median ¥51,115, rural ¥20,711.",
    ],
    source: "nbsIncome2025",
  },
  quintiles2025: {
    text: [
      "2025 年按五等份分组的人均可支配收入：低收入组 10,150 元，中间偏下组 22,702 元，中间组 35,536 元，中间偏上组 55,586 元，高收入组 103,778 元。",
      "2025 per-capita disposable income by quintile: ¥10,150, ¥22,702, ¥35,536, ¥55,586 and ¥103,778.",
    ],
    source: "nbsIncome2025",
  },
  consumption2025: {
    text: ["2025 年全国居民人均消费支出 29,476 元。", "In 2025 per-capita consumer spending was ¥29,476."],
    source: "nbsIncome2025",
  },
  wage2025: {
    text: [
      "2025 年城镇非私营单位就业人员平均工资 129,441 元，私营单位 71,590 元；东部地区非私营单位 149,902 元。",
      "2025 average wage: ¥129,441 in urban non-private units and ¥71,590 in private units; ¥149,902 for non-private units in the east.",
    ],
    source: "nbsWage2025",
  },
  wageIndustry2025: {
    text: [
      "2025 年平均工资最高的行业：信息传输、软件和信息技术服务业 248,752 元，金融业 211,164 元。",
      "Highest-paid sectors in 2025: information technology ¥248,752 and finance ¥211,164.",
    ],
    source: "nbsWage2025",
  },
  unemployment2025: {
    text: [
      "2025 年全国城镇调查失业率平均 5.2%；30–59 岁劳动力平均 4.0%。",
      "China's surveyed urban unemployment averaged 5.2% in 2025; 4.0% for workers aged 30–59.",
    ],
    source: "nbsJobs2025",
  },
  lifeExpectancy2024: {
    text: ["2024 年我国居民人均预期寿命 79.0 岁。", "Life expectancy in China reached 79.0 years in 2024."],
    source: "nhcHealth2024",
  },
  marriage2024: {
    text: [
      "2024 年全国结婚登记 610.6 万对，结婚率 4.3‰；依法办理离婚 351.3 万对。",
      "In 2024 China registered 6.106 million marriages (4.3 per 1,000 people) and 3.513 million divorces.",
    ],
    source: "mcaBulletin2024",
  },
  vehicles2024: {
    text: [
      "2024 年底全国汽车保有量 3.53 亿辆，其中新能源汽车 3,140 万辆。",
      "At the end of 2024 China had 353 million cars, 31.4 million of them new-energy vehicles.",
    ],
    source: "mpsVehicles2024",
  },
  lpr2026: {
    text: [
      "2026 年 10 月 20 日，5 年期以上贷款市场报价利率（LPR）为 3.5%。",
      "On 20 October 2026 the five-year-plus Loan Prime Rate was 3.5%.",
    ],
    source: "lpr",
  },
  iit: {
    text: [
      "综合所得每年减除 6 万元；子女教育、3 岁以下婴幼儿照护每孩每月 2,000 元，住房租金每月 800–1,500 元，首套房贷利息每月 1,000 元。",
      "Consolidated income allows ¥60,000 a year plus ¥2,000 a month per child, ¥800–1,500 a month for rent or ¥1,000 for first-home mortgage interest.",
    ],
    source: "iit",
  },
}                               ;
                                        
/** Quintile means placed at each group's middle percentile; the 50th point is the published median. */
const incomePoints2025                     = [
  [10, 10150],
  [30, 22702],
  [50, 36231],
  [70, 55586],
  [90, 103778],
];
/** Game setting: published 2025 levels grow 4.5% a year in later simulated years. */
export const incomeGrowth = 0.045;
/** Rough national percentile of per-capita household income for a simulated year. Between published points the
 * value is interpolated; above the top group's mean a Pareto tail (α = 2, a game setting) is assumed. */
export function incomePercentile(perCapita        , year        ) {
  const scale = (1 + incomeGrowth) ** Math.max(0, year - 2025);
  const points = incomePoints2025.map(([p, v]) => [p, yuan(v) * scale]         );
  if (perCapita <= 0) return 0;
  const [p0, v0] = points[0];
  if (perCapita <= v0) return (p0 * perCapita) / v0;
  for (let i = 1; i < points.length; i++) {
    const [pa, va] = points[i - 1];
    const [pb, vb] = points[i];
    if (perCapita <= vb) return pa + ((pb - pa) * (perCapita - va)) / (vb - va);
  }
  const [, top] = points[points.length - 1];
  return Math.min(99.9, 100 - 10 * (top / perCapita) ** 2);
}
