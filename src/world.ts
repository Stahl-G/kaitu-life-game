import type { Text, WorldId } from "./model.js";
import { clamp } from "./model.js";
import { normal, sample } from "./random.js";
/** World layer from design v5: a reality mode that stays on the continuity line, and a parallel mode where five
 * world variables walk from the first simulated year and branch into six worlds in 2035. Variables, branch rules
 * and economic modifiers are authored game settings. World and ending text comes from the six-world event table
 * draft (2026-10-28); English is translated for the game. Branches after 2035 are science-fiction scenarios. */
export type Mode = "reality" | "parallel";
export const BRANCH_YEAR = 2035;
export const axes = ["ai", "automation", "inequality", "corporate", "pressure"] as const;
export type Axis = (typeof axes)[number];
export const axisLabels: Record<Axis, Text> = {
  ai: ["AI 能力", "AI capability"],
  automation: ["自动化比例", "Automation"],
  inequality: ["贫富差距", "Inequality"],
  corporate: ["企业相对国家权力", "Corporate power"],
  pressure: ["气候与冲突压力", "Climate and conflict"],
};
const origin: Record<Axis, number> = { ai: 0.35, automation: 0.3, inequality: 0.45, corporate: 0.35, pressure: 0.35 };
const drift: Record<Axis, number> = { ai: 0.034, automation: 0.03, inequality: 0.004, corporate: 0.012, pressure: 0.012 };
const walks = new Map<string, Record<Axis, number>[]>();
/** Seeded random walk of the world variables; personal choices never change it. */
export function worldAxes(seed: string, year: number): Record<Axis, number> {
  let walk = walks.get(seed);
  if (!walk) {
    walk = [{ ...origin }];
    if (walks.size > 64) walks.clear();
    walks.set(seed, walk);
  }
  const index = Math.max(0, Math.min(year - 2026, 120));
  while (walk.length <= index) {
    const y = 2026 + walk.length;
    const previous = walk[walk.length - 1];
    walk.push(
      Object.fromEntries(
        axes.map((k) => [k, clamp(previous[k] + drift[k] + normal(seed, y, `axis-${k}`) * 0.045, 0, 1)]),
      ) as Record<Axis, number>,
    );
  }
  return walk[index];
}
/** Thresholds tuned so each world appears in roughly 14–21% of world seeds. */
export function classify(a: Record<Axis, number>): WorldId {
  if (a.ai > 0.71 && a.automation > 0.6) return "agi_flood";
  if (a.corporate > 0.57) return "corporate_war";
  if (a.pressure > 0.56) return "bloc_conflict";
  if (a.automation > 0.5 && a.inequality < 0.51) return "post_scarcity";
  if (a.inequality > 0.48 && a.ai > 0.58) return "cyberpunk";
  return "continuity";
}
export function worldFor(mode: Mode, seed: string, year: number): WorldId {
  if (mode === "reality" || year < BRANCH_YEAR) return "continuity";
  return classify(worldAxes(seed, BRANCH_YEAR));
}
export interface WorldInfo {
  name: Text;
  basis: Text;
  ending: Text;
  news: Text[];
}
export const worlds: Record<WorldId, WorldInfo> = {
  continuity: {
    name: ["延续世界", "Continuity"],
    basis: ["数值底座：IPCC SSP2", "Basis: IPCC SSP2"],
    ending: [
      "这条世界线没有突然替你解决一切。城市修修补补，工作会变，老店也会关门。你的故事发生在这些缓慢变化之间，而不是一张等着填满的成功清单上。",
      "This world line did not suddenly solve everything for you. The city patched itself up, jobs changed, old shops closed. Your story happened among these slow changes, not on a checklist of successes waiting to be filled.",
    ],
    news: [
      [
        "连续几个夏天太热，城市把一段公交站迁到有树的一侧。通勤多走了两分钟，等车终于不必站在烤盘上。",
        "After several scorching summers the city moved a row of bus stops to the shady side. The walk is two minutes longer, and waiting no longer feels like standing on a grill.",
      ],
      [
        "社区开了个每月一次的修补摊。最抢手的不是智能工具，而是一位会换拉链的人。",
        "The neighbourhood started a monthly repair stall. The busiest person was not a smart tool but someone who could replace zips.",
      ],
      [
        "街角换了一块招牌，常坐的长椅重新刷了漆。这一年没有什么上新闻的大事。",
        "The corner shop got a new sign and your usual bench was repainted. Nothing this year made the news.",
      ],
    ],
  },
  cyberpunk: {
    name: ["赛博朋克", "Cyberpunk"],
    basis: ["数值底座：IPCC SSP4（不平等）", "Basis: IPCC SSP4 (inequality)"],
    ending: [
      "技术让一些门开得很快，也让另一些门更难解释为什么关着。你没有一个人修好这座城市；但你记得哪些入口依赖账户，哪些地方仍有人愿意先听你说话。",
      "Technology made some doors open fast and made it harder to explain why others stayed shut. You did not fix the city alone, but you remember which entrances depended on an account and where someone would still listen first.",
    ],
    news: [
      [
        "热浪让街道空了半边。高架步道的降温系统只向订阅者开放，桥下却有人把废广告布拉成遮阳棚。",
        "A heatwave emptied half the street. The elevated walkway's cooling was for subscribers only; under the bridge someone stretched old advertising cloth into a sunshade.",
      ],
      [
        "遮阳棚添了饮水桶，旧风扇被贴上“客服”标签：有意见请对它吹。",
        "The sunshade gained a water barrel, and an old fan was labelled “customer service: complain into it”.",
      ],
      [
        "遮阳棚最后被登记成了公共休息点。入口没有人脸屏，只挂着一张纸：“水桶空了，请告诉里面的人。”",
        "The sunshade was registered as a public rest stop. There is no face scanner at the entrance, only a note: “If the water runs out, tell someone inside.”",
      ],
    ],
  },
  corporate_war: {
    name: ["公司战争", "Corporate war"],
    basis: [
      "科幻设定：只借 SSP5 的经济与能源数字",
      "Science fiction; borrows only SSP5 economic and energy figures",
    ],
    ending: [
      "公司更换了城里的规则，合同、交通、住处常常拴在同一根线上。你留下的这一段，不只关于站在哪一边，也关于哪些承诺没有跟着商标一起改名。",
      "Companies rewrote the city's rules; contracts, transport and housing were often tied to the same string. What you leave behind is not only about which side you stood on, but about which promises did not change name with the logo.",
    ],
    news: [
      [
        "两家企业的结算争端持续了一周，跨园区地铁暂停互认。你在步行绕路上发现一家天没亮就开门的豆浆铺。",
        "A billing dispute between two companies suspended cross-campus metro tickets for a week. On the walking detour you found a soy-milk stall that opens before dawn.",
      ],
      [
        "互认还没恢复，街坊先做出一张纸质换乘图：哪道门认临时通行证，哪里有坡道，哪里能歇脚。",
        "Before tickets were reconciled, neighbours drew a paper transfer map: which gates take temporary passes, where the ramps are, where to rest.",
      ],
      [
        "又一家企业换了标志，城里的门禁声还是那一声。你留下几张纸质联系方式，不必先申请导出。",
        "Another company changed its logo; the city's gates still beep the same way. You keep a few paper contact cards that need no export request.",
      ],
    ],
  },
  post_scarcity: {
    name: ["后稀缺社会", "Post-scarcity"],
    basis: ["数值底座：IPCC SSP1；后稀缺为科幻扩展", "Basis: IPCC SSP1; post-scarcity is a fictional extension"],
    ending: [
      "基本物资不再是每日最紧的绳子，座位、注意和一起度过的时间却仍有边界。你不必把空出的每一天换成另一种绩效；有人愿意来，也可以有人今天不来。",
      "Basic goods stopped being the tightest rope of the day, but seats, attention and time together still had limits. You did not have to turn every free day into another kind of performance; someone could come, and someone could stay away today.",
    ],
    news: [
      [
        "食物和日用品的供应趋于充裕，老城区临河空间却不能无限复制。改造后的公共凉亭开始按时段预约。",
        "Food and daily goods became plentiful, but the old riverside could not be copied. The renovated pavilion started taking bookings.",
      ],
      [
        "社区把一半日落时段留给轮候，另一半不预约、到场共享。长椅旁多摆了矮凳。",
        "The neighbourhood kept half the sunset slots for a queue and half for whoever turns up. Low stools appeared beside the bench.",
      ],
      [
        "东西更容易得到，约定、注意和彼此的时间依然需要慢慢商量。",
        "Things are easier to get; promises, attention and each other's time still need slow negotiation.",
      ],
    ],
  },
  agi_flood: {
    name: ["AGI 机器泛滥", "AGI flood"],
    basis: ["科幻设定，无官方数字；不写人类灭绝", "Science fiction with no official figures; no extinction story"],
    ending: [
      "机器继续运转，许多职业已经改名或消失，关键入口仍由少数机构掌握。这不是人类灭绝的故事，而是便利、工作与决定权没有一同分配的未来。",
      "The machines kept running; many jobs were renamed or gone, and the key entrances stayed with a few institutions. This is not a story of human extinction. It is a future where convenience, work and the power to decide were not shared out together.",
    ],
    news: [
      [
        "你工作的部门还在，只是九成任务已由机器排队完成。新周报要求填写“本周人类介入理由”。",
        "Your department still exists, but machines now finish nine tenths of the tasks. The new weekly report asks for “reasons for human intervention this week”.",
      ],
      [
        "街上的机器把餐食和日用品做得很便宜，城里却只有几家公司能决定谁可调用主系统。",
        "Machines on the street made meals and daily goods cheap, yet only a few companies decide who may call the main system.",
      ],
      [
        "清扫机器人总把树下的落叶卷走。附近的人圈出一小块，请它留下。第二天它绕得很夸张，像在给一片叶子让座。",
        "The cleaning robot kept sweeping away the leaves under the tree. Neighbours marked a patch and asked it to leave them. The next day it swerved dramatically, as if offering a leaf a seat.",
      ],
    ],
  },
  bloc_conflict: {
    name: ["集团对抗", "Bloc conflict"],
    basis: ["数值底座：IPCC SSP3（区域对抗）", "Basis: IPCC SSP3 (regional rivalry)"],
    ending: [
      "跨区的路更难走了，消息、货物与熟人常被不同的规则隔开。你走过的是这条世界线中的一段，不是所有地区注定拥有的同一种结局。",
      "Roads between blocs grew harder; news, goods and friends were often separated by different rules. You walked one stretch of this world line, not an ending every region was bound to share.",
    ],
    news: [
      [
        "车站贴出本区与跨区两张时刻表，第二张改得越来越勤。市场照常开门，只是每次出行都多了几个过去不用回答的问题。",
        "The station posted two timetables, home bloc and cross-border, and the second kept changing. Markets stayed open; every trip just came with a few new questions.",
      ],
      [
        "这一轮供应中断让整条街提早关灯。有人把椅子搬到门口，顺手给路过的人留一张。",
        "Supply cuts turned the street's lights off early. Someone carried chairs to the doorway and left one for passers-by.",
      ],
      [
        "公共维修点重新开门，公告没有写“恢复如初”，只列出现在能处理的三类问题。",
        "The public repair point reopened. The notice did not say “back to normal”; it listed the three kinds of problems it can handle now.",
      ],
    ],
  },
};
/** Projections shown on the shared line before the branch; written for the game, labelled as projections. */
export const sharedNews: Text[] = [
  [
    "AI 助手进了大多数办公软件，会议纪要不再需要人来整理。",
    "AI assistants are now built into most office software; nobody writes meeting minutes by hand.",
  ],
  [
    "延迟退休按月推进，同事们午饭时互相算自己的退休年份。",
    "The gradual rise in retirement age continues; colleagues compare their new retirement years over lunch.",
  ],
  [
    "新能源车占了新车销量的大半，小区停车场装了一排快充桩。",
    "New-energy cars take most new-car sales; the estate car park installs a row of fast chargers.",
  ],
  [
    "社区多了两家日间照料中心，门口排队的多是陪老人来的子女。",
    "Two day-care centres for older people opened nearby; the queue is mostly adult children bringing parents.",
  ],
  [
    "夏天又创了新高温，城市把午后户外作业改到清晨。",
    "Another record-hot summer; the city moves afternoon outdoor work to early morning.",
  ],
  [
    "楼下便利店换成了无人店，原来的夜班店员调去做配送调度。",
    "The corner shop became staffless; the night-shift clerk moved to delivery dispatch.",
  ],
  [
    "医保电子凭证替代了实体卡，父母学会了用手机挂号。",
    "Digital health-insurance cards replaced plastic ones; parents learned to book appointments by phone.",
  ],
  ["出生人口继续减少，小区幼儿园合并了两个班。", "Fewer babies again; the estate kindergarten merged two classes."],
  ["公司开始按周记录“AI 节省的工时”，周报里多了一栏，没人知道该怎么填。", "Your company now logs “hours saved by AI” each week; the report gained a column nobody knows how to fill in."],
  ["地铁新线通到了城市边缘，沿线的房租第二个月就涨了。", "A new metro line reached the edge of the city; rents along it rose by the second month."],
  ["个人养老金账户的宣传单塞进了每一封工资条邮件。", "Leaflets for private pension accounts arrived with every payslip email."],
  ["城市取消了部分落户限制，人才市场的海报从“抢人”换成了“留人”。", "The city relaxed residence registration; job-fair posters switched from “attracting talent” to “keeping it”."],
  ["外卖平台给骑手上了统一的职业伤害保障，配送费每单涨了几毛钱。", "Delivery platforms gave riders standard injury cover; each order cost a few jiao more."],
  ["高铁又通了三条线，回老家从五个小时变成了三个小时。", "Three more high-speed lines opened; the trip home dropped from five hours to three."],
  ["老旧小区加装电梯的公告贴满了楼道，一楼和六楼的住户意见不一。", "Notices about fitting lifts in old blocks filled the stairwells; ground-floor and sixth-floor residents disagreed."],
  ["自动驾驶出租车在几个区开了试运营，第一批乘客大多是好奇的年轻人。", "Driverless taxis began trial runs in a few districts; the first riders were mostly curious young people."],
  ["存款利率又降了一次，银行门口理财产品的海报换了新的收益率。", "Deposit rates fell again; the wealth-product posters outside banks got new yields."],
  ["社区食堂开到了每个街道，午饭十五块，来吃的不只有老人。", "Community canteens opened in every subdistrict; lunch costs fifteen yuan and not only older people come."],
  ["职业技能补贴扩大了范围，晚上的培训班比白天还满。", "Subsidies for vocational training widened; evening classes filled up faster than daytime ones."],
  ["一场大台风过后，城市开始重新规划低洼地带的地下车库。", "After a major typhoon the city began redesigning underground car parks in low-lying areas."],
  ["网上开始流行“县城生活”的视频，几个朋友真的搬回了老家。", "Videos about small-town life went viral; a few friends really did move back home."],
  ["二手房挂牌量创了新高，中介门店却关了一半。", "Second-hand listings hit a record while half the estate agencies closed."],
  ["社保卡能直接在全国看病结算了，异地就医不用再先垫钱。", "Social security cards now settle medical bills nationwide; no more paying up front when treated away from home."],
  ["很多公司把年终奖改成了按季度发，大家年底的心情平淡了一些。", "Many companies switched year-end bonuses to quarterly payments; December felt flatter."],
  ["电动自行车新规落地，楼下停车棚装上了自动断电的充电桩。", "New e-bike rules took effect; the shed downstairs got chargers that cut out automatically."],
  ["城市开放了更多二十四小时自习室，晚上十点的座位最难抢。", "The city opened more 24-hour study rooms; seats at ten at night were hardest to get."],
  ["“银发经济”成了新闻里的高频词，老年大学报名网站开放五分钟就满。", "The “silver economy” was everywhere in the news; the seniors' university filled its places five minutes after opening."],
  ["数字人民币可以在菜市场用了，摊主的收款码多了一个。", "The digital yuan reached the wet market; stallholders added another payment code."],
  ["夏天的用电高峰让写字楼实行错峰上班，早上八点的地铁空了一些。", "Summer peak demand brought staggered office hours; the eight o'clock trains emptied a little."],
  ["几家大厂宣布每周四天半工作制试点，招聘页面上开始写“不加班”。", "A few big firms piloted a four-and-a-half-day week; job ads began to promise “no overtime”."],
  ["新的个税专项附加扣除提高了标准，很多人第一次认真打开了个税 App。", "Higher special deductions for income tax meant many people opened the tax app properly for the first time."],
  ["小区里的快递柜换成了无人车，傍晚会自己开到楼下。", "The estate's parcel lockers became small driverless vans that come to the door in the evening."],
  ["城市开始推行垃圾分类积分，换来的鸡蛋成了老人们最认真的理由。", "Rubbish-sorting points were introduced; free eggs became older residents' most serious motivation."],
  ["医院普及了 AI 预问诊，候诊时手机会先问你哪里不舒服。", "Hospitals rolled out AI pre-consultations; while you wait, your phone asks what is wrong first."],
  ["一批新能源车企倒闭，车主群里讨论起了“没有原厂的车怎么修”。", "Several electric-car makers went under; owners' chats discussed repairing cars without a manufacturer."],
  ["长租公寓有了统一的押金监管，租房合同终于不用押三付一。", "Long-term rental flats got regulated deposits; leases no longer demanded three months up front."],
  ["“灵活就业”人数又创新高，社保窗口专门开了一个柜台。", "Flexible employment hit another record; the social security office opened a dedicated window."],
  ["城市马拉松名额要靠抽签，跑步的人比十年前多了一倍。", "City marathon places were drawn by lottery; twice as many people run as a decade ago."],
  ["学校推行课后延时服务，家长群里的接孩子接龙少了一半。", "Schools extended after-school care; the parents' pick-up rota chat halved."],
  ["老年人防诈骗讲座开进了每个社区，讲到一半总有人举手说自己差点被骗。", "Anti-fraud talks for older people reached every community; halfway through, someone always admits a near miss."],
  ["光伏板铺满了城郊的厂房屋顶，电价在白天出现了负数。", "Solar panels covered suburban factory roofs; daytime power prices briefly went negative."],
  ["城市更新拆掉了一片老街，最后一个周末，很多人回去拍照。", "Urban renewal cleared an old street; on its last weekend many people came back to take photos."],
  ["宠物医院比儿科门诊还多了，新闻说这是第一次。", "Vet clinics now outnumber paediatric clinics; the news called it a first."],
  ["失业保险金的领取改成了全程线上，申请从两周缩短到三天。", "Unemployment benefit claims went fully online; processing dropped from two weeks to three days."],
  ["县城开了第一家大型仓储超市，周末的停车场停满了外地牌照。", "The county town got its first warehouse supermarket; at weekends the car park filled with out-of-town plates."],
  ["人口普查的新数据公布，老年人口占比又上了一个台阶。", "New census figures came out; the share of older people rose another step."],
  ["几座城市试行“住房以旧换新”，旧房按评估价抵首付。", "Several cities piloted trading in old homes, with valuations counting toward the new deposit."],
  ["公司体检加了心理问卷，结果只发给本人，不进人事档案。", "The workplace check-up added a mental-health questionnaire; results go only to you, not to HR."],
];
export const crisisNews: Text[] = [
  ["全球经济进入衰退，工厂订单减少，很多公司冻结招聘。", "A global recession: factory orders fall and many firms freeze hiring."],
  ["出口订单接连取消，港口的集装箱堆成了山，招聘网站上的岗位少了三成。", "Export orders kept being cancelled; containers piled up at the port and job listings fell by a third."],
  ["几家大公司同时宣布裁员，朋友圈里“求内推”的消息一周比一周多。", "Several big firms announced lay-offs at once; requests for referrals multiplied week by week."],
  ["消费降温，商场里的空铺多了，打折的海报贴到了第二层玻璃上。", "Spending cooled; empty units multiplied at the mall and sale posters went up two layers deep."],
];
/** This world's order of shared or world news: a seeded shuffle, so a life never reads the same item twice. */
export function newsOrder(seed: string, length: number, key: string) {
  return Array.from({ length }, (_, i) => i).sort(
    (a, b) => sample(seed, a, `${key}-order`) - sample(seed, b, `${key}-order`),
  );
}
export const transitionNews: Text = [
  "新的规则送到邮箱时，旧日历上还有几个答应过的约定。你把需要改时间的圈出来，逐个告知对方。世界转弯，并不替人抹掉此前发生的生活。",
  "When the new rules reached your inbox, the old calendar still held promises. You circled the ones that had to move and told each person. The world turning does not erase the life lived before it.",
];
/** Yearly economic shifts after the branch: added to index returns, salary growth, inflation and rent growth,
 * and to the yearly crisis probability. Game settings. */
export const worldModifiers: Record<
  WorldId,
  { stocks: number; wage: number; inflation: number; rent: number; crisis: number; jobLoss: number }
> = {
  continuity: { stocks: 0, wage: 0, inflation: 0, rent: 0, crisis: 0, jobLoss: 1 },
  cyberpunk: { stocks: 0.02, wage: -0.005, inflation: 0.01, rent: 0.03, crisis: 0.02, jobLoss: 1.3 },
  corporate_war: { stocks: 0.01, wage: 0.01, inflation: 0.01, rent: 0.02, crisis: 0.05, jobLoss: 1.2 },
  post_scarcity: { stocks: 0.01, wage: -0.01, inflation: -0.03, rent: -0.01, crisis: -0.04, jobLoss: 0.8 },
  agi_flood: { stocks: 0.05, wage: -0.03, inflation: -0.015, rent: 0, crisis: 0.02, jobLoss: 2 },
  bloc_conflict: { stocks: -0.03, wage: -0.01, inflation: 0.03, rent: 0.01, crisis: 0.08, jobLoss: 1.4 },
};
/** Hidden world (人机融合): five conditions drawn independently per world seed with the v5 probabilities
 * (about 1.03% jointly), then the player must still be in the simulation when the war ends. The draft schedule
 * put the war in the 2060s, past every 10/20/30-year window from today; this game schedule moves it earlier. */
export const hiddenConfig = {
  probabilities: { contact: 0.05, ai: 0.7, robots: 0.7, war: 0.6, victory: 0.7 },
  contact: [2036, 2042] as const,
  /** Years after the robotics threshold: the war over autonomous machines never starts before machines exist. */
  warAfterRobots: [1, 4] as const,
  warYears: [2, 4] as const,
};
export interface HiddenChain {
  contactOk: boolean;
  aiOk: boolean;
  robotsOk: boolean;
  warOk: boolean;
  victoryOk: boolean;
  unlocked: boolean;
  contact: number;
  ai: number;
  robots: number;
  warStart: number;
  warEnd: number;
}
export function hiddenChain(seed: string): HiddenChain {
  const p = hiddenConfig.probabilities;
  const yes = (key: keyof typeof p) => sample(seed, 0, `hidden-${key}`) < p[key];
  const pickYear = ([a, b]: readonly [number, number], key: string) =>
    a + Math.floor(sample(seed, 0, `hidden-year-${key}`) * (b - a + 1));
  const contact = pickYear(hiddenConfig.contact, "contact");
  const warStart = contact + 2 + pickYear(hiddenConfig.warAfterRobots, "war");
  const contactOk = yes("contact");
  const aiOk = yes("ai");
  const robotsOk = yes("robots");
  const warOk = yes("war");
  const victoryOk = yes("victory");
  return {
    contactOk,
    aiOk,
    robotsOk,
    warOk,
    victoryOk,
    unlocked: contactOk && aiOk && robotsOk && warOk && victoryOk,
    contact,
    ai: contact + 1,
    robots: contact + 2,
    warStart,
    warEnd: warStart + pickYear(hiddenConfig.warYears, "length"),
  };
}
export const hiddenNews: Record<"contact" | "ai" | "robots" | "warStart" | "warEnd" | "unlock", Text> = {
  contact: [
    "一段反复校验的信号被公开确认：来自地外的交流不是误码。最先被翻译出的内容没有讲宇宙终极答案，只是在核对彼此怎样计时。",
    "A repeatedly checked signal was confirmed: contact from beyond Earth was not a glitch. The first translated content held no ultimate answers; it was about how each side keeps time.",
  ],
  ai: [
    "研究机构承认，新的 AI 已能独立完成此前需要团队多年才能做的推演。街头的第一反应不是欢呼，而是问：谁有权决定它拿来做什么？",
    "Research institutes admitted the new AI can produce analyses that used to take teams years. The first reaction on the street was not cheering but a question: who decides what it is for?",
  ],
  robots: [
    "新一代机器人终于能处理那些歪斜、磨损、没有说明书的零件。新闻片里最动人的镜头，是一位维修师傅第一次准点下班。",
    "New robots can finally handle crooked, worn, undocumented parts. The most moving shot in the news was a repair technician leaving on time for the first time.",
  ],
  warStart: [
    "多地围绕自主机器的控制权爆发武装冲突，公共服务被迫切换到应急模式。你收到的通知没有胜利口号，只有停运时间和附近开放的服务点。",
    "Armed conflict broke out over control of autonomous machines and public services switched to emergency mode. Your notice had no slogans, only suspension times and the nearest open service point.",
  ],
  warEnd: [
    "由人类控制的联合机构重新接管关键系统，战事结束。广播先播报恢复供水的街区，再播报胜利。很多人只记住了第一项。",
    "A human-controlled joint agency took back the critical systems and the war ended. The broadcast listed districts with water restored before it announced victory. Many remembered only the first part.",
  ],
  unlock: [
    "停战后，一项来自地外交流与人机研究的联合协议开放了试验接口。世界第一次允许意识与外部计算协作，但没有任何人被默认登记参加。",
    "After the ceasefire, a joint protocol from contact research and human-machine studies opened an experimental interface. Minds could now work with outside computation, and nobody was signed up by default.",
  ],
};
export const hiddenEndings: Record<"bridge" | "witness", { title: Text; text: Text }> = {
  bridge: {
    title: ["桥两端都有名字", "Both ends of the bridge have names"],
    text: [
      "你体验过一段与外部计算及另一位志愿者共同感知的时间，也亲手结束了连接。人机融合没有让你成为统一答案；你仍保留拒绝、修改和独处的位置。",
      "You spent a while sensing the world together with outside computation and another volunteer, and you ended the connection yourself. Merging with machines did not turn you into one shared answer; you kept your place to refuse, to revise and to be alone.",
    ],
  },
  witness: {
    title: ["没有过桥的人也在未来里", "Those who did not cross are in the future too"],
    text: [
      "你没有参加桥接体验，而是留下了这个时代的口述记录。未来没有因为一次拒绝就把你落下；人机融合属于世界的可能性，不是每个人的义务。",
      "You did not take part in the bridge; you left an oral record of the era instead. The future did not leave you behind for saying no once; merging with machines was a possibility of the world, not everyone's duty.",
    ],
  },
};
