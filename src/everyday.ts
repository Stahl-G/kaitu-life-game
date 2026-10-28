import type { Event } from "./engine.js";
import { expense, income, liquid, yuan } from "./finance.js";
import { type Market, type State, type Text, changeProps } from "./model.js";
import type { FactId } from "./stats.js";
/** Everyday events that know where and with whom the player lives: city or hometown, rent or own, partner,
 * children, parents, car and stated goals. Original text; amounts follow the simulated price level. */
interface Def {
  id: string;
  text: Text | ((s: State) => Text);
  when?: (s: State, m: Market) => boolean;
  fx?: Partial<State["props"]>;
  /** Yuan at the first year's prices; negative is a cost. */
  money?: number;
  weight?: number;
  cooldown?: number;
  facts?: FactId[];
  also?: (s: State) => void;
}
const renting = (s: State) => s.housing === "rent" || s.housing === "shared";
const couple = (s: State) => s.family.partner === "living" || s.family.partner === "married";
const partner = (s: State): Text => s.family.partnerName ?? ["对方", "your partner"];
const kidAges = (s: State, year: number) => s.family.children.map((born) => year - born);
const hasParents = (s: State) => s.family.parentsBorn !== null;
const here = (s: State) => (s.place === "hometown" ? s.hometown : s.city);
const defs: Def[] = [
  {
    id: "city-move-flat",
    text: [
      "房东要卖房，给了你两个月找房。新房子离地铁远了一站，阳台却朝南。",
      "Your landlord is selling and gave you two months to move. The new flat is a stop further from the metro, but its balcony faces south.",
    ],
    when: (s) => renting(s) && s.place === "city",
    fx: { happiness: -2 },
    money: -3000,
    cooldown: 6,
  },
  {
    id: "city-last-metro",
    text: [
      "连续两周加班到末班地铁。车厢里的人都很安静，像在各自补觉。",
      "Two weeks of overtime ended on the last metro every night. Everyone in the carriage was quiet, as if catching up on sleep.",
    ],
    when: (s) => s.place === "city" && s.role === "employed",
    fx: { health: -3, relationships: -1 },
  },
  {
    id: "city-craft-market",
    text: [
      "周末的手作市集上，你买了一只杯子。摊主说烧坏了三只才成这一只。",
      "At a weekend craft market you bought a cup; the maker said three had cracked in the kiln before this one.",
    ],
    when: (s) => s.place === "city",
    fx: { happiness: 3 },
    money: -180,
  },
  {
    id: "city-friend-leaves",
    text: (s) => [
      `又一个朋友离开了${s.city}。走前你们在常去的面馆坐到打烊。`,
      `Another friend left ${s.city}. Before they went you sat in your usual noodle shop until closing.`,
    ],
    when: (s) => s.place === "city",
    fx: { relationships: -1, happiness: -1 },
  },
  {
    id: "city-river-run",
    text: [
      "你开始沿着河边夜跑。第一次跑完五公里那晚，在便利店买了一瓶冰水庆祝。",
      "You started evening runs along the river; the night you first finished five kilometres you celebrated with a cold bottle of water.",
    ],
    when: (s) => s.exercise || s.focus === "health",
    fx: { health: 4, happiness: 2 },
    weight: 16,
  },
  {
    id: "neighbour-parcels",
    text: [
      "隔壁邻居出差一周，托你收快递。回来时带了一盒家乡的点心。",
      "Your neighbour, away for a week, asked you to collect parcels and came back with a box of hometown pastries.",
    ],
    fx: { relationships: 3 },
  },
  {
    id: "hometown-evenings",
    text: [
      "下班走十分钟就到家，傍晚多出了一个小时。你开始在河边散步。",
      "Home is a ten-minute walk from work; evenings gained an hour, and you started walking by the river.",
    ],
    when: (s) => s.place === "hometown",
    fx: { health: 2, happiness: 2 },
  },
  {
    id: "hometown-reunion",
    text: [
      "高中同学聚会，一半的人都回来了。有人开了奶茶店，有人在考编。",
      "At a high-school reunion half the class had moved back: one ran a tea shop, another was studying for the civil-service exam.",
    ],
    when: (s) => s.place === "hometown",
    fx: { relationships: 4 },
    money: -300,
  },
  {
    id: "hometown-wednesdays",
    text: [
      "每周三去父母家吃饭成了习惯。母亲开始提前问你下周想吃什么。",
      "Wednesday dinners at your parents' became a habit; your mother now asks ahead what you want next week.",
    ],
    when: (s) => s.place === "hometown" && hasParents(s),
    fx: { relationships: 3, happiness: 2 },
  },
  {
    id: "hometown-slow-career",
    text: [
      "老家的工作节奏慢。你偶尔刷到以前同事升职的消息，看完把手机扣在了桌上。",
      "Work back home moves slowly. Now and then you see a former colleague's promotion online and put the phone face down.",
    ],
    when: (s) => s.place === "hometown" && s.role === "employed",
    fx: { happiness: -2, knowledge: -1 },
  },
  {
    id: "home-paint",
    text: [
      "你把新房的墙刷成了浅绿色。邻居说像一间诊所，你没改。",
      "You painted your new home pale green. A neighbour said it looked like a clinic; you kept it.",
    ],
    when: (s) => s.housing === "owned" && s.flags.homeBought !== undefined,
    fx: { happiness: 3 },
    money: -15000,
    cooldown: 99,
  },
  {
    id: "home-ceiling-leak",
    text: [
      "楼上漏水泡了天花板。物业协调了一个月，最后对方赔了修补费。",
      "A leak from upstairs soaked your ceiling. After a month of mediation the neighbours paid for the repair.",
    ],
    when: (s) => s.housing === "owned",
    fx: { happiness: -2 },
  },
  {
    id: "mortgage-reprice",
    text: [
      "银行发来短信：房贷利率按新的 LPR 重定价，月供几乎没变。",
      "The bank texted that your mortgage repriced on the new LPR; the monthly payment barely moved.",
    ],
    when: (s) => s.mortgage !== null,
    facts: ["lpr2026"],
    cooldown: 6,
  },
  {
    id: "partner-hometown-dish",
    text: (s) => [
      `${partner(s)[0]}学会了做你老家的一道菜，盐放多了一点。`,
      `${partner(s)[1]} learned a dish from your hometown, a little too salty.`,
    ],
    when: couple,
    fx: { relationships: 3, happiness: 2 },
  },
  {
    id: "partner-rota",
    text: [
      "你们为了周末去谁家吵了一架，最后在冰箱上贴了一张轮流表。",
      "You argued over whose family to visit at the weekend and ended up with a rota on the fridge.",
    ],
    when: couple,
    fx: { relationships: -1, happiness: -1 },
  },
  {
    id: "partner-train-film",
    text: [
      "你们第一次一起出远门，在高铁上把同一部电影看了两遍。",
      "Your first long trip together: on the high-speed train you watched the same film twice.",
    ],
    when: (s) => s.family.partner !== "none" && s.travel !== "none",
    fx: { relationships: 4, happiness: 3 },
    money: -2000,
    cooldown: 8,
  },
  {
    id: "dating-friends",
    text: (s) => [
      `${partner(s)[0]}第一次见你的朋友们。散场时，最挑剔的那位说“这个人可以”。`,
      `${partner(s)[1]} met your friends for the first time. Leaving, the pickiest of them said: “this one's fine”.`,
    ],
    when: (s) => s.family.partner === "dating",
    fx: { relationships: 3 },
    cooldown: 99,
  },
  {
    id: "kid-night-fever",
    text: [
      "孩子半夜发烧，你们抱着去儿童医院，排到了凌晨两点。",
      "Your child ran a fever at night; you queued at the children's hospital until two in the morning.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a <= 6),
    fx: { health: -2, relationships: 2 },
    money: -600,
  },
  {
    id: "kid-first-word",
    text: [
      "孩子第一次说出了一个像“妈妈”又像“猫”的词，全家争了一晚上。",
      "Your child's first word sounded half like “mum” and half like “cat”; the family argued about it all evening.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 1 && a <= 2),
    fx: { happiness: 5, relationships: 3 },
    cooldown: 99,
  },
  {
    id: "kid-crayons",
    text: [
      "家长会上，老师说孩子上课爱画画。你回家路上买了一盒新蜡笔。",
      "At the parents' meeting the teacher said your child draws in class. You bought new crayons on the way home.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 6 && a <= 15),
    fx: { relationships: 2, happiness: 2 },
    money: -80,
  },
  {
    id: "kid-tutoring",
    text: [
      "同学都报了补习班。你们算了一晚上，最后只报了一门。",
      "Every classmate takes tutoring. After an evening of sums you signed up for one subject only.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 8 && a <= 17),
    fx: { happiness: -1 },
    money: -6000,
  },
  {
    id: "parents-visit",
    text: [
      "父母来住了一周。冰箱被塞满了，走的时候又带走了一半。",
      "Your parents stayed a week. The fridge was crammed full, and half of it went home with them.",
    ],
    when: (s) => hasParents(s) && s.place === "city",
    fx: { relationships: 3, happiness: 1 },
  },
  {
    id: "parents-phone-booking",
    text: [
      "你远程教父亲用手机挂号。教到第三遍，他说：“我截图了。”",
      "You taught your father to book a doctor by phone. On the third try he said: “I took a screenshot.”",
    ],
    when: hasParents,
    fx: { relationships: 2, knowledge: 1 },
    cooldown: 8,
  },
  {
    id: "parents-chillies",
    text: [
      "母亲在院子里种了一排辣椒，视频里举起一个给你看。",
      "Your mother planted a row of chillies in the yard and held one up on video.",
    ],
    when: hasParents,
    fx: { relationships: 2 },
  },
  {
    id: "car-scrape",
    text: [
      "车在地下车库被刮了一道，对方留了电话，赔了 600 元。",
      "Someone scraped your car in the car park, left a number and paid ¥600.",
    ],
    when: (s) => s.car,
    fx: { happiness: -1 },
  },
  {
    id: "car-old-town",
    text: [
      "开车带父母去了两小时外的古镇，父亲一路都在指路。",
      "You drove your parents to an old town two hours away; your father gave directions the whole way.",
    ],
    when: (s) => s.car && hasParents(s),
    fx: { relationships: 4, happiness: 2 },
    money: -800,
  },
  {
    id: "car-chargers",
    text: ["小区装了新的充电桩，晚上排队的车少了一半。", "New chargers went in at your estate; the evening queue halved."],
    when: (s) => s.car,
    fx: { happiness: 1 },
    cooldown: 99,
  },
  {
    id: "goal-small-steps",
    text: (s) => {
      const goal = s.goals[0] ?? "";
      return [
        `你又往“${goal}”走了一步：这个月把它拆成了三件能做完的小事。`,
        `You moved “${goal}” forward: this month you broke it into three small things you could finish.`,
      ];
    },
    when: (s) => s.goals.length > 0,
    fx: { knowledge: 1, happiness: 2 },
  },
  {
    id: "goal-second",
    text: (s) => {
      const goal = s.goals[1] ?? s.goals[0] ?? "";
      return [
        `关于“${goal}”，你找到一个做过这件事的人，请对方喝了杯咖啡，听了一个小时。`,
        `For “${goal}”, you found someone who had done it, bought them a coffee and listened for an hour.`,
      ];
    },
    when: (s) => s.goals.length > 1,
    fx: { knowledge: 2, relationships: 1 },
    money: -60,
  },
  {
    id: "side-consulting",
    text: [
      "朋友介绍了一个周末的咨询活，三个周末赚了 9,000 元。",
      "A friend passed you a weekend consulting job; three weekends earned ¥9,000.",
    ],
    when: (s) => s.role === "employed" && s.props.knowledge >= 60,
    fx: { health: -2 },
    money: 9000,
  },
  {
    id: "tax-refund",
    text: [
      "个税年度汇算多退了 1,200 元。你把它转进了旅行基金。",
      "The annual tax reconciliation refunded ¥1,200; it went into the travel fund.",
    ],
    when: (s) => s.role === "employed",
    fx: { happiness: 2 },
    money: 1200,
    facts: ["iit"],
    cooldown: 6,
  },
  {
    id: "fake-service-call",
    text: [
      "有人自称客服，打电话说要帮你“关闭百万保障”。你挂断后把号码举报了。",
      "A caller posing as customer service offered to “cancel your million-yuan cover”. You hung up and reported the number.",
    ],
    when: (s) => liquid(s.assets) > yuan(20000),
    fx: { knowledge: 1 },
    cooldown: 8,
  },
  {
    id: "work-ai-tools",
    text: [
      "公司换了新的 AI 工具。你每周省下半天，也被要求多管一个项目。",
      "The company rolled out new AI tools; you saved half a day a week and were asked to run one more project.",
    ],
    when: (s, m) => s.role === "employed" && m.year >= 2027,
    fx: { knowledge: 2, happiness: -1 },
    cooldown: 6,
  },
  {
    id: "work-promotion",
    text: [
      "年中评审，你升了一级。工资涨了一截，也多了两个人的周报要看。",
      "At the mid-year review you were promoted: a raise, and two more people's weekly reports to read.",
    ],
    when: (s) => s.role === "employed" && s.props.knowledge >= 55,
    fx: { happiness: 3, health: -1 },
    facts: ["wage2025"],
    cooldown: 4,
    also: (s) => {
      s.salary = Math.round(s.salary * 1.08);
    },
  },
  {
    id: "work-standups",
    text: [
      "新来的主管喜欢开早会。你学会了把要说的事压进三句话。",
      "The new manager loves morning stand-ups. You learned to fit your update into three sentences.",
    ],
    when: (s) => s.role === "employed",
    fx: { knowledge: 2 },
  },
  {
    id: "work-remote-day",
    text: [
      "公司开始每周一天远程。你在家附近的面馆吃了第一顿工作日午饭。",
      "The company introduced one remote day a week; you had your first weekday lunch at the noodle shop near home.",
    ],
    when: (s, m) => s.role === "employed" && m.year >= 2028,
    fx: { happiness: 2, health: 1 },
    cooldown: 99,
  },
  {
    id: "checkup-flag",
    text: [
      "体检报告上多了一个上箭头。医生说先少吃夜宵，三个月后复查。",
      "Your check-up flagged one value. The doctor said cut late-night snacks and come back in three months.",
    ],
    when: (s) => s.age >= 33,
    fx: { health: -1 },
  },
  {
    id: "phone-outside-bedroom",
    text: [
      "你把手机留在客厅过夜。第三周开始，早上不用闹钟也能醒。",
      "You started leaving your phone in the living room overnight; by the third week you woke without an alarm.",
    ],
    when: (s) => s.exercise || s.focus === "health" || s.props.health < 45,
    fx: { health: 3, happiness: 2 },
  },
  {
    id: "hot-summer",
    text: (s) => [
      `${here(s)}连续半个月 38℃，空调电费一个月四百多。你开始早上六点出门。`,
      `Two weeks at 38°C in ${here(s)}; the air-conditioning bill topped ¥400 a month and you started leaving at six.`,
    ],
    when: (_s, m) => m.year >= 2029,
    fx: { health: -1 },
    money: -400,
  },
  {
    id: "stairwell-cat",
    text: [
      "楼道里的流浪猫跟着你回了家。第二天你买了猫砂，名字想了一个星期。",
      "A stray cat from the stairwell followed you home. You bought litter the next day and spent a week choosing a name.",
    ],
    when: (s) => !s.family.pet,
    fx: { happiness: 4 },
    money: -800,
    cooldown: 99,
    also: (s) => {
      s.family.pet = true;
    },
  },
  // Life stages
  {
    id: "age-wedding-season",
    text: [
      "这一年随了五份份子钱。到第五场婚礼，你终于学会了怎么跟不熟的亲戚寒暄。",
      "Five wedding gifts this year. By the fifth wedding you had learned how to make small talk with distant relatives.",
    ],
    when: (s) => s.age <= 33 && (s.family.partner === "none" || s.family.partner === "dating"),
    fx: { relationships: 2 },
    money: -3000,
  },
  {
    id: "age-reunion-twenty",
    text: [
      "大学毕业二十年聚会，班长做了一页幻灯片列出每个人的近况。你那一行写得最短，聊得却最久。",
      "Twenty years after graduation, the class monitor made a slide of everyone's news. Your line was the shortest; your conversation ran longest.",
    ],
    when: (s) => s.age >= 40 && s.age <= 48,
    fx: { relationships: 3, happiness: 1 },
    cooldown: 99,
  },
  {
    id: "age-reading-glasses",
    text: [
      "你第一次配了老花镜。店员说这很正常，你还是在店门口站了一会儿。",
      "You got your first reading glasses. The optician said it was normal; you still stood outside the shop for a while.",
    ],
    when: (s) => s.age >= 44,
    fx: { health: -1 },
    money: -600,
    cooldown: 99,
  },
  {
    id: "age-retirement-countdown",
    text: [
      "人事系统里多了一行“距退休”。你把攒下的年假一条条列了出来。",
      "The HR system grew a new line: “until retirement”. You listed the leave you had saved up, day by day.",
    ],
    when: (s) => s.age >= 56 && s.role === "employed",
    fx: { happiness: 1 },
    cooldown: 99,
  },
  {
    id: "age-new-flatmate",
    text: [
      "合租的室友换了人。新室友会做饭，冰箱里第一次有了自己腌的酸菜。",
      "A new flatmate moved in who cooks; for the first time the fridge held a jar of home-pickled cabbage.",
    ],
    when: (s) => s.housing === "shared" && s.age <= 35,
    fx: { relationships: 2, happiness: 2 },
  },
  // Children, by age
  {
    id: "kid-newborn-nights",
    text: [
      "孩子三个小时醒一次。你们排了夜班表，白天开会时你在笔记本上画了一只羊。",
      "The baby woke every three hours. You drew up a night rota, and in a daytime meeting you caught yourself drawing a sheep in your notebook.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a <= 1),
    fx: { health: -3, relationships: 1, happiness: 1 },
  },
  {
    id: "kid-kindergarten",
    text: [
      "幼儿园摇号那天，你们都请了假盯着手机。结果出来的时候，两个人都松了口气。",
      "On kindergarten lottery day you both took leave to watch your phones. When the result came, you both breathed out.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a === 3),
    fx: { happiness: 2 },
    money: -2000,
    cooldown: 99,
  },
  {
    id: "kid-homework",
    text: [
      "晚上九点的数学作业，题目从“一个水池”开始。你和孩子一起找到了三种解法，也都困了。",
      "Nine o'clock maths homework began with “a water tank…”. You and your child found three ways to solve it, and were both sleepy by the end.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 7 && a <= 12),
    fx: { knowledge: 2, health: -1, relationships: 2 },
  },
  {
    id: "kid-parents-meeting",
    text: [
      "家长会上，老师说孩子上课爱接话。回家路上孩子问：“那我是不是挺勇敢的？”",
      "At the parents' meeting the teacher said your child keeps answering out of turn. On the way home the child asked: “So I'm quite brave, then?”",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 6 && a <= 15),
    fx: { relationships: 2, happiness: 2 },
  },
  {
    id: "kid-summer-camp",
    text: [
      "暑假夏令营要四千多。孩子回来晒黑了一圈，一路都在讲新认识的朋友。",
      "Summer camp cost over four thousand. Your child came back tanned and talked about new friends all the way home.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 8 && a <= 14),
    fx: { happiness: 2 },
    money: -4200,
  },
  {
    id: "kid-teen-door",
    text: [
      "孩子开始关上房门。你学会了先敲门，也学会了等。周末一起看球，孩子主动给你讲了越位。",
      "Your child started closing the bedroom door. You learned to knock, and to wait. Watching football at the weekend, your child explained offside to you unasked.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 13 && a <= 17),
    fx: { relationships: 1, happiness: 1 },
  },
  {
    id: "kid-gaokao",
    text: [
      "高考那两天，你在考场外的树荫下站了很久。孩子出来只说了一句“还行”，你们去吃了那家要排队的面。",
      "For the two days of the gaokao you stood a long time in the shade outside. Your child came out saying only “fine”, and you went for the noodles with the queue.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a === 18),
    fx: { happiness: 2 },
    money: -800,
    cooldown: 99,
  },
  {
    id: "kid-leaves-home",
    text: [
      "孩子去外地上学了。家里突然很安静，你把那个房间的灯开着睡了好几晚。",
      "Your child left for university in another city. The flat went quiet; for several nights you slept with the light on in that room.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a === 19),
    fx: { happiness: -3, relationships: 1 },
    money: -8000,
    cooldown: 99,
  },
  {
    id: "kid-own-family",
    text: [
      "孩子带着自己的孩子回来过年。你抱起那个小小的人，手比想象中稳。",
      "Your child came home for New Year with a child of their own. You picked up the tiny person; your hands were steadier than you expected.",
    ],
    when: (s, m) => kidAges(s, m.year).some((a) => a >= 27),
    fx: { relationships: 4, happiness: 5 },
    cooldown: 99,
  },
  // Parents
  {
    id: "parents-video-call",
    text: [
      "你教父母用视频通话。第一次接通只看到天花板，第二次是半张脸，第三次他们在镜头前笑。",
      "You taught your parents to video call. The first time you saw only the ceiling, the second half a face, the third both of them laughing into the camera.",
    ],
    when: (s) => hasParents(s) && s.family.care !== "together" && s.place === "city",
    fx: { relationships: 3, happiness: 2 },
    cooldown: 99,
  },
  {
    id: "parents-night-call",
    text: [
      "半夜接到电话，父亲住院观察一晚。你订了最早一班车，赶到时他已经在问能不能回家。",
      "A call in the night: your father was kept in hospital for observation. You caught the first train; by the time you arrived he was asking to go home.",
    ],
    when: (s, m) => hasParents(s) && m.year - (s.family.parentsBorn ?? m.year) >= 70,
    fx: { health: -2, happiness: -2 },
    money: -2500,
  },
  {
    id: "parents-new-year",
    text: [
      "春运的票抢了三天。年三十晚上，妈妈把你小时候不爱吃的菜也做了一盘。",
      "Three days of trying for Spring Festival tickets. On New Year's Eve your mother also cooked the dish you refused as a child.",
    ],
    when: (s) => hasParents(s) && s.place === "city" && s.family.care !== "together",
    fx: { relationships: 3, happiness: 2 },
    money: -1800,
  },
  {
    id: "parents-supplement-article",
    text: [
      "妈妈转发了一篇“保健品包治百病”的文章。你没有争，打电话聊了半小时，她说那就先不买。",
      "Your mother forwarded an article about a cure-all supplement. You did not argue; after half an hour on the phone she said she would hold off.",
    ],
    when: (s, m) => hasParents(s) && m.year - (s.family.parentsBorn ?? m.year) >= 65,
    fx: { relationships: 1, knowledge: 1 },
  },
  {
    id: "parents-old-roof",
    text: [
      "老家的房子要不要翻修，亲戚们在群里讨论了一晚上。最后决定先换屋顶。",
      "The relatives' group chat debated all evening whether to renovate the family house. In the end: the roof first.",
    ],
    when: (s, m) => hasParents(s) && m.year - (s.family.parentsBorn ?? m.year) >= 65 && s.place === "city",
    fx: { relationships: 1 },
    money: -6000,
    cooldown: 8,
  },
  // Home
  {
    id: "owner-lift-meeting",
    text: [
      "业主群为电梯维修费吵了三天。你在业主大会上第一次举手发言，说完手心都是汗。",
      "The owners' chat argued for three days over lift repairs. At the owners' meeting you spoke up for the first time, palms damp afterwards.",
    ],
    when: (s) => s.housing === "owned",
    fx: { relationships: 2, knowledge: 1 },
  },
  {
    id: "owner-water-heater",
    text: [
      "热水器坏了。师傅说换新比修划算，你在冷水澡和一千八之间选了后者。",
      "The water heater died. The repairman said a new one beat a repair; between cold showers and ¥1,800 you chose the latter.",
    ],
    when: (s) => s.housing === "owned",
    money: -1800,
  },
  {
    id: "upstairs-renovation",
    text: [
      "楼上开始装修，电钻每天早上八点准时响起。你去附近的咖啡店办公了两周。",
      "The flat upstairs began renovating; the drill started at eight sharp every morning. You worked from a nearby café for two weeks.",
    ],
    when: (s) => s.housing === "owned" || s.housing === "rent",
    fx: { happiness: -2 },
    money: -600,
  },
  {
    id: "renter-deposit-video",
    text: [
      "退租时房东想扣押金。你翻出入住那天拍的视频，一帧一帧对着看，押金退回来了一大半。",
      "Moving out, the landlord tried to keep the deposit. You found the video from move-in day and went through it frame by frame; most of the deposit came back.",
    ],
    when: (s) => renting(s),
    fx: { knowledge: 1, happiness: 1 },
    money: 1200,
  },
  {
    id: "renter-kind-landlord",
    text: [
      "房东来修水管，顺手把阳台的旧纱窗也换了。临走说今年房租不涨。",
      "The landlord came to fix a pipe, replaced the old balcony screen while there, and said on leaving that the rent would not rise this year.",
    ],
    when: (s) => s.housing === "rent",
    fx: { happiness: 2 },
  },
  // Car
  {
    id: "car-seaside",
    text: [
      "你们开车去了一趟海边。高速服务区的烤肠比想象中好吃，回来的路上谁都没说话，都很满足。",
      "You drove to the seaside. The service-station sausages were better than expected; on the way back nobody spoke, everyone content.",
    ],
    when: (s) => s.car && (couple(s) || s.family.children.length > 0),
    fx: { happiness: 4, relationships: 3 },
    money: -2000,
  },
  {
    id: "car-parking-fee",
    text: [
      "小区车位费从每月三百涨到五百。你在“卖车”和“再忍一年”之间犹豫了一个晚上。",
      "Parking went up from ¥300 to ¥500 a month. You spent an evening torn between selling the car and putting up with it for another year.",
    ],
    when: (s) => s.car && s.place === "city",
    fx: { happiness: -1 },
    money: -2400,
  },
  // Work, by role
  {
    id: "work-reorg",
    text: [
      "部门重组，你换了第三个领导。新领导第一次开会就说：“流程先不改。”",
      "Another reorganisation brought your third manager. At the first meeting the new one said: “No process changes for now.”",
    ],
    when: (s) => s.role === "employed",
    fx: { happiness: -1, knowledge: 1 },
  },
  {
    id: "work-mentee",
    text: [
      "你带的新人第一次独立做完项目。复盘会上，新人把你的名字写在了感谢页上。",
      "The newcomer you had been training finished a project alone for the first time and put your name on the thank-you slide.",
    ],
    when: (s) => s.role === "employed" && s.experience >= 8,
    fx: { relationships: 3, happiness: 3 },
  },
  {
    id: "work-annual-review",
    text: [
      "年终考核表有十二页。写到“自我评价”那一栏，你停了很久。",
      "The annual review form ran to twelve pages. At “self-assessment” you paused for a long time.",
    ],
    when: (s) => s.role === "employed",
    fx: { knowledge: 1, happiness: -1 },
  },
  {
    id: "founder-payroll",
    text: [
      "这个月的工资照常发了出去，你自己的那一份推迟了两周。",
      "Everyone's pay went out on time this month. Yours waited two weeks.",
    ],
    when: (s) => s.role === "founder",
    fx: { happiness: -1, relationships: 2 },
  },
  {
    id: "founder-big-client",
    text: [
      "第一个大客户签了一年的合同。你在楼梯间给合作的人打电话，回声都在笑。",
      "Your first big client signed for a year. You phoned your co-founder from the stairwell; even the echo was laughing.",
    ],
    when: (s) => s.role === "founder",
    fx: { happiness: 5 },
    money: 8000,
    cooldown: 99,
  },
  {
    id: "student-group-work",
    text: [
      "小组作业最后只有你一个人在改格式。答辩那天，组员请你喝了奶茶。",
      "By the end you were the only one fixing the group report's formatting. On presentation day the group bought you bubble tea.",
    ],
    when: (s) => s.role === "student",
    fx: { relationships: 1, knowledge: 2 },
  },
  {
    id: "retired-choir",
    text: [
      "你报名了社区合唱团。第一次排练站在最后一排，第三次就被调到了中间。",
      "You joined the community choir. At the first rehearsal you stood in the back row; by the third you had been moved to the middle.",
    ],
    when: (s) => s.role === "retired",
    fx: { happiness: 4, relationships: 3 },
  },
  {
    id: "jobs-fair",
    text: [
      "招聘会上排队的人很多。你投了九份简历，收到两条“已读”。",
      "The jobs fair was crowded. You handed in nine CVs and got two “read” receipts.",
    ],
    when: (s) => s.role === "unemployed",
    fx: { happiness: -2, knowledge: 1 },
  },
  {
    id: "abroad-chilli-sauce",
    text: [
      "在国外的超市找到了老家常吃的辣酱，价格是国内的三倍。你还是买了两瓶。",
      "In a supermarket abroad you found the chilli sauce from home at three times the price. You bought two jars anyway.",
    ],
    when: (s) => s.abroad,
    fx: { happiness: 2 },
    money: -120,
  },
  // Each parallel world after the branch
  {
    id: "world-agi-colleague",
    text: [
      "公司给每个人配了一个“协作体”。它比你先读完了所有文件，你开始练习怎样提出更好的问题。",
      "Everyone at work was assigned a “collaborator”. It finished reading every file before you did, so you started practising better questions.",
    ],
    when: (_s, m) => m.world === "agi_flood",
    fx: { knowledge: 2, happiness: -1 },
  },
  {
    id: "world-cyberpunk-adverts",
    text: [
      "地铁站的广告屏会叫出你的名字。你关掉了三个授权，第四个关不掉。",
      "The metro's advert screens called out your name. You switched off three permissions; the fourth would not switch off.",
    ],
    when: (_s, m) => m.world === "cyberpunk",
    fx: { happiness: -2 },
  },
  {
    id: "world-four-day-week",
    text: [
      "每周工作缩到四天。多出来的那一天，你起初不知道怎么用，后来去学了木工。",
      "The working week shrank to four days. At first you did not know what to do with the extra day; then you took up woodwork.",
    ],
    when: (_s, m) => m.world === "post_scarcity",
    fx: { happiness: 3, knowledge: 2 },
  },
  {
    id: "world-company-badge",
    text: [
      "园区门禁换成了公司自己的身份系统。你的工牌和城市交通卡第一次不能通用。",
      "The business park switched to the company's own identity system. For the first time your work badge and the city transit card no longer worked in each other's gates.",
    ],
    when: (_s, m) => m.world === "corporate_war",
    fx: { happiness: -2, relationships: -1 },
  },
  {
    id: "world-parts-shortage",
    text: [
      "进口零件断供，楼下的手机维修店贴出告示：部分型号暂停维修。你把旧手机又用了一年。",
      "Imported parts stopped arriving; the phone repair shop downstairs posted a notice suspending some models. You kept your old phone another year.",
    ],
    when: (_s, m) => m.world === "bloc_conflict",
    fx: { happiness: -1, knowledge: 1 },
  },
  // Money and the calendar
  {
    id: "fund-statement",
    text: [
      "年度基金对账单寄到了。你第一次认真读完了收费那一页。",
      "The annual fund statement arrived. For the first time you read the fees page all the way through.",
    ],
    when: (s) => s.assets.stocks > 0 || s.assets.bonds > 0,
    fx: { knowledge: 2 },
  },
  {
    id: "savings-round-number",
    text: [
      "存款第一次过了一个整数。你没告诉任何人，只是那天晚饭多加了一个菜。",
      "Your savings passed a round number for the first time. You told no one; dinner that night had one extra dish.",
    ],
    when: (s) => liquid(s.assets) >= yuan(300000) * s.priceLevel,
    fx: { happiness: 3 },
    cooldown: 99,
  },
  {
    id: "shopping-festival",
    text: [
      "双十一凌晨，你清空了购物车，第二天又退了一半。",
      "At midnight on Singles' Day you emptied your basket; the next day you returned half of it.",
    ],
    when: (s) => s.age <= 45,
    fx: { happiness: 1 },
    money: -800,
  },
  {
    id: "mid-autumn-away",
    text: [
      "中秋没有回家。同事分了你一块五仁月饼，你们讨论了半天它到底好不好吃。",
      "You did not go home for Mid-Autumn. A colleague shared a five-nut mooncake and you debated at length whether it was any good.",
    ],
    when: (s) => s.place === "city" && s.role === "employed" && s.family.care !== "together",
    fx: { relationships: 2, happiness: 1 },
  },
  {
    id: "hometown-market-day",
    text: (s) => [
      `${s.hometown || "老家"}逢集的日子，你跟着人流走了一上午，买回一把竹扫帚和一兜橘子。`,
      `It was market day in ${s.hometown || "your hometown"}. You drifted with the crowd all morning and came back with a bamboo broom and a bag of mandarins.`,
    ],
    when: (s) => s.place === "hometown",
    fx: { happiness: 2, relationships: 1 },
    money: -60,
  },
  {
    id: "partner-anniversary",
    text: (s) => [
      `你和${partner(s)[0]}的纪念日，两个人都忘了。第二天想起来，一起笑了很久，补了一顿火锅。`,
      `You and ${partner(s)[1]} both forgot your anniversary. Remembering the next day, you laughed for ages and made up for it with hotpot.`,
    ],
    when: (s) => couple(s),
    fx: { relationships: 3, happiness: 2 },
    money: -400,
  },
];
export const everydayEvents: Event[] = defs.map((d) => ({
  id: `day-${d.id}`,
  text: d.text,
  cooldown: d.cooldown ?? 5,
  ...(d.facts ? { facts: d.facts } : {}),
  ...(d.when ? { eligible: d.when } : {}),
  weight: (s) =>
    (d.weight ?? 12) +
    (d.fx?.health && d.fx.health > 0 ? (100 - s.props.health) / 10 : 0) +
    (d.fx?.relationships && d.fx.relationships > 0 ? (100 - s.props.relationships) / 14 : 0),
  apply: (s, j) => {
    if (d.fx) changeProps(s, d.fx);
    const amount = Math.round(yuan(Math.abs(d.money ?? 0)) * s.priceLevel);
    if ((d.money ?? 0) < 0) expense(s.assets, j, amount, "unexpected");
    if ((d.money ?? 0) > 0) income(s.assets, j, amount, "extra-income");
    d.also?.(s);
  },
}));
