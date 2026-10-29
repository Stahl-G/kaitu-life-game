import { applyDecision, eligibility } from "./decisions.js";
import {
               
  annuity,
  borrow,
  expense,
  income,
  liquid,
  transfer,
  yuan,
} from "./finance.js";
import { crashThreshold } from "./market.js";
import {
                    
              
            
             
             
            
               
  changeProps,
  decisionLabels,
  rmb,
} from "./model.js";
import { tiers } from "./places.js";
import { sample } from "./random.js";
                                         
import { BRANCH_YEAR,            hiddenChain } from "./world.js";
/** Gated choices replace the old fixed decision years: time stops only when a threshold in the player's life is
 * reached (a contract, a large purchase, a move, a family change, an illness). Each option states its known
 * costs up front; outcomes that depend on luck are not previewed. */
                                                                                      
export const trackLabels                      = {
  work: ["工作", "Work"],
  money: ["钱", "Money"],
  home: ["居住", "Home"],
  family: ["家庭", "Family"],
  health: ["健康", "Health"],
  far: ["远方", "Further afield"],
  world: ["世界", "World"],
};
                         
             
              
                
                  
                                                     
                 
                        
                                                      
                                                          
 
                              
               
                 
                 
                 
             
               
                    
 
                         
             
               
                                                                
                   
                                         
                                        
                                       
                   
                                              
                                                                   
 
const story = (id        , text      , kind                = "decision")        => ({ id, text, kind });
const money = (fen        ) => rmb(fen);
const zh = (t      ) => t[0];
const en = (t      ) => t[1];
const price = (s       , fen        ) => Math.round(fen * s.priceLevel);
const asked = (s       , id        ) => s.asked[id] !== undefined;
const since = (s       , id        , years        , year        ) =>
  s.asked[id] === undefined || year - (s.asked[id] ?? 0) >= years;
/** Times in a row the player has carried on at a repeating choice (counted in the simulation after each answer). */
export const carriedOn = (s       , id        ) => s.flags[`carried-${id}`] ?? 0;
/** A repeating choice answered with "carry on" comes back at growing intervals instead of nagging. */
const again = (s       , id        , years        , year        ) =>
  since(s, id, years * (1 + carriedOn(s, id)), year);
/** One of several wordings, fixed by the life seed and year, so two lives giving the same answer read differently. */
const oneOf = (c             , id        , texts        ) =>
  texts[Math.floor(sample(c.seed, c.year, `copy-${id}`) * texts.length)];
/** The carry-on story of a repeating choice changes as the answer repeats; each step may have several wordings. */
const nth = (s       , c             , id        , texts                   ) => {
  const step = texts[Math.min(carriedOn(s, id), texts.length - 1)];
  return typeof step[0] === "string" ? (step        ) : oneOf(c, id, step          );
};
/** Game settings for insurance premiums, by age at purchase. */
export const premiums = {
  medical: (age        ) => yuan(300 + Math.max(0, age - 25) * 30),
  critical: (age        ) => yuan(4500 + Math.max(0, age - 25) * 220),
};
/** Game setting for a first-home commercial mortgage; real rates are priced off the five-year LPR. */
export const mortgageRate = 0.031;
const downOptions = [0.2, 0.3, 0.4]         ;
const yearOptions = [20, 25, 30]         ;
const reserve = yuan(20000);
export function homePrice(s       , where                     ) {
  const t = tiers[where === "city" ? s.tier : s.homeTier];
  return price(s, t.homePrice * t.homeSize);
}
export function homeSize(s       , where                     ) {
  return tiers[where === "city" ? s.tier : s.homeTier].homeSize;
}
/** Smallest affordable share of the price paid up front, or null if even two tenths is out of reach. */
export function minimumDown(s       , total        ) {
  const fees = Math.round(total * 0.02);
  const available = liquid(s.assets) + s.assets.fund - reserve - fees;
  return downOptions.find((d) => total * d <= available) ?? null;
}
export function mortgagePayment(total        , down        , years        ) {
  return annuity(Math.round(total * (1 - down)), mortgageRate, years);
}
function buyHome(s       , j         , c             , where                     , pick      ) {
  const total = homePrice(s, where);
  const down = pick.down ?? 0.3;
  const years = pick.years ?? 30;
  if (!downOptions.includes(down                                ) || !yearOptions.includes(years      ))
    throw new Error("无效的房贷设置 / Invalid mortgage settings");
  const min = minimumDown(s, total);
  if (min === null || down < min) throw new Error("首付不够 / Not enough for this down payment");
  const deposit = Math.round(total * down);
  expense(s.assets, j, Math.round(total * 0.02), "home-fees");
  transfer(s.assets, j, "fund", "cash", Math.min(s.assets.fund, deposit), "fund-withdrawal");
  if (s.assets.cash < deposit) transfer(s.assets, j, "deposits", "cash", deposit - s.assets.cash, "withdrawal");
  borrow(s.assets, j, total - deposit, "mortgage", "mortgage-loan");
  transfer(s.assets, j, "cash", "property", total, "home-purchase");
  s.mortgage = { rate: mortgageRate, payment: mortgagePayment(total, down, years), months: years * 12 };
  s.housing = "owned";
  s.rent = 0;
  s.flags.homeBought = c.year;
  if (where === "hometown") {
    s.salary = Math.round((s.salary * tiers[s.homeTier].wage) / tiers[s.tier].wage);
    s.place = "hometown";
    s.tier = s.homeTier;
    s.flags.jobSince = c.year;
    s.family.care = "nearby";
    expense(s.assets, j, price(s, yuan(8000)), "moving");
    changeProps(s, { relationships: 6, happiness: 3, knowledge: -1 });
    return [
      story("choice-home-hometown", [
        `你把${s.hometown}那套房的首付付了，也在当地找好了工作。搬家那天，父母在楼下等了一个上午。`,
        `You paid the deposit on a home in ${s.hometown} and found work there. On moving day your parents waited downstairs all morning.`,
      ]),
    ];
  }
  s.flags.longCommute = c.year;
  changeProps(s, { happiness: 4, health: -1 });
  return [
    story("choice-home-city", [
      `你在${s.city}买下了 ${homeSize(s, "city")}㎡ 的房子。钥匙交到手上那天，你先算了一遍新的通勤路线。`,
      `You bought a ${homeSize(s, "city")} m² home in ${s.city}. The day you got the keys, you worked out the new commute first.`,
    ]),
  ];
}
const careerCosts                             = {
  career: ["求职 ¥4,500 · 可能待业", "Search ¥4,500 · Job-gap risk"],
  business: ["客户、回款与融资", "Customers, cash flow, financing"],
  abroad: ["搬迁最高 ¥48,000", "Relocation up to ¥48,000"],
  invest: ["流动资金的 40% · 有涨有跌", "40% of available cash · Gains or losses"],
  study: ["学费 ¥28,000 · 暂停全职", "Tuition ¥28,000 · Leave full-time work"],
  stay: ["维持安排 · 风险仍在", "Keep routines · Risks remain"],
  custom: ["试作 ¥4,500", "An experiment · ¥4,500"],
};
                    
              
             
               
                                                          
                                                                  
 
/** Employment turning points of each world, text from the six-world event table draft. */
const worldJobs                            = {
  continuity: {
    title: ["周五的组织调整", "Friday's reorganisation"],
    body: [
      "部门被并入另一条业务线。新主管要你兼做客户支持，却暂时不改职级。走廊里大家都在说“先看看”，这时，一家同行也发来已写清职责的岗位邀请。",
      "Your department was merged into another business line. The new manager wants you to cover customer support without a change in grade. Everyone in the corridor says “let's wait and see”; meanwhile a competitor sends an offer with clearly written duties.",
    ],
    stay: "hold",
    options: [
      {
        id: "write",
        label: ["留任一年，把职责和补休写下来", "Stay a year and get duties and time off in writing"],
        effects: [["工资 +3%，知识 +2", "Pay +3%, knowledge +2"]],
      },
      {
        id: "move",
        label: ["接外部岗位，保留交接时间", "Take the outside offer with a handover period"],
        effects: [["工资 +12%，关系 −2", "Pay +12%, people −2"]],
      },
      {
        id: "hold",
        label: ["暂不决定，按原约定工作", "Decide nothing yet and work as agreed"],
        effects: [["一切照旧", "Nothing changes"]],
      },
    ],
    apply(s, _j, option) {
      if (option === "write") {
        s.salaryFactor *= 1.03;
        changeProps(s, { knowledge: 2, happiness: -1 });
      } else if (option === "move") {
        s.salaryFactor *= 1.12;
        changeProps(s, { relationships: -2, happiness: 2 });
      }
    },
  },
  cyberpunk: {
    title: ["工资单上的可见性", "Visibility on the payslip"],
    body: [
      "雇主推出全天“协作镜”，声称摄像头只计算效率，不保存影像。不启用的人仍可领原薪，却进不了远程岗位池。你的工作能力没有变，能被看见的方式变了。",
      "Your employer rolled out an all-day “collaboration mirror” that claims to measure efficiency without storing images. Those who opt out keep their pay but lose access to remote roles. Your skills have not changed; the way you are seen has.",
    ],
    stay: "hours",
    options: [
      {
        id: "hours",
        label: ["只开工作时段，申请书面数据边界", "Allow it in work hours with written data limits"],
        effects: [["快乐 −2，知识 +1", "Happiness −2, knowledge +1"]],
      },
      {
        id: "onsite",
        label: ["拒用，继续做无需镜头的现场岗", "Refuse and keep an on-site role without cameras"],
        effects: [["工资 −10%，快乐 +2", "Pay −10%, happiness +2"]],
      },
      {
        id: "offline",
        label: ["申请已有空缺的离线维护岗", "Apply for an open offline maintenance role"],
        effects: [["工资 −15%，知识 +3", "Pay −15%, knowledge +3"]],
      },
    ],
    apply(s, _j, option) {
      if (option === "hours") changeProps(s, { happiness: -2, knowledge: 1 });
      if (option === "onsite") {
        s.salaryFactor *= 0.9;
        changeProps(s, { happiness: 2, health: -1 });
      }
      if (option === "offline") {
        s.salaryFactor *= 0.85;
        changeProps(s, { knowledge: 3 });
      }
    },
  },
  corporate_war: {
    title: ["工资系统换了旗帜", "The payroll system changed flags"],
    body: [
      "你的部门被并入青穹的用工系统。新合同把住房折扣和离职绑定；旧合同还能保留，但只接原园区的项目。人事发来两张表，文件名都叫“最终版”。",
      "Your department was absorbed into Qingqiong's labour system. The new contract ties a housing discount to staying; the old one can be kept but only covers projects on the original campus. HR sent two forms, both named “final”.",
    ],
    stay: "old",
    options: [
      {
        id: "new",
        label: ["转新合同，接受附带限制", "Switch to the new contract and its conditions"],
        effects: [["工资 +10%，房租 −20%", "Pay +10%, rent −20%"]],
      },
      {
        id: "old",
        label: ["保留旧合同和原工作范围", "Keep the old contract and scope"],
        effects: [["一切照旧", "Nothing changes"]],
      },
    ],
    apply(s, _j, option) {
      if (option !== "new") return;
      s.salaryFactor *= 1.1;
      if (s.housing === "rent") s.rent = Math.round(s.rent * 0.8);
      s.flags.companyContract = 1;
      changeProps(s, { happiness: -1 });
    },
  },
  post_scarcity: {
    title: ["不再需要满周工时", "No longer a full week"],
    body: [
      "自动化让你所在的团队只需原来一半工时。基本生活保障不随工时变化；部门让大家自选保留四天的复杂任务岗，或换成两天的值守岗，两种都算正式任职。",
      "Automation halved the hours your team needs. Basic living support does not depend on hours; you may keep a four-day role on complex work or switch to two days on call. Both count as proper jobs.",
    ],
    stay: "four",
    options: [
      {
        id: "four",
        label: ["留在四天岗，做复杂任务", "Keep the four-day role on complex work"],
        effects: [["工资 −10%，知识 +2", "Pay −10%, knowledge +2"]],
      },
      {
        id: "two",
        label: ["改两天值守，空出另外的日子", "Switch to two days and free the rest"],
        effects: [["工资 −45%，快乐 +5，关系 +4", "Pay −45%, happiness +5, people +4"]],
      },
    ],
    apply(s, _j, option) {
      if (option === "four") {
        s.salaryFactor *= 0.9;
        changeProps(s, { knowledge: 2 });
      } else {
        s.salaryFactor *= 0.55;
        changeProps(s, { happiness: 5, relationships: 4, health: 2 });
      }
    },
  },
  agi_flood: {
    title: ["两张不同的工牌", "Two different badges"],
    body: [
      "公司给你两个方案：保留劳动合同，改做低工时、低薪的人工责任窗口；或领一笔固定离岗补助。机器是否接管早已不是选项，你能决定的是接下来还把多少时间放在这里。",
      "The company offers two plans: keep your contract in a low-hour, low-pay human accountability desk, or take a fixed exit payment. Whether machines take over is no longer the question; you decide how much more of your time stays here.",
    ],
    stay: "desk",
    options: [
      {
        id: "desk",
        label: ["留下做人工责任窗口", "Stay at the human accountability desk"],
        effects: [["工资 −40%", "Pay −40%"]],
      },
      {
        id: "exit",
        label: ["接受离岗补助，离开这份工作", "Take the exit payment and leave"],
        effects: [["一次拿到 1.5 年工资，之后要重新找事做", "1.5 years' pay at once, then find something new"]],
      },
    ],
    apply(s, j, option, year) {
      if (option === "desk") {
        s.salaryFactor *= 0.6;
        changeProps(s, { happiness: -2 });
        return;
      }
      income(s.assets, j, Math.round(s.salary * s.salaryFactor * 1.5), "exit-payment");
      s.role = "unemployed";
      s.flags.jobLost = year;
      changeProps(s, { happiness: -3 });
    },
  },
  bloc_conflict: {
    title: ["工作迁过来，人要不要去", "The job moves; do you?"],
    body: [
      "公司把岗位收回本区中心，提供一次搬迁补贴；留下则转做较低薪的本地维护。两份合同都还在，不是“敢不敢拼”的测试：一份改变住处，一份改变收入和工种。",
      "The company is moving roles back to the bloc's centre with a one-off relocation grant; staying means lower-paid local maintenance. Both contracts are real; it is not a test of nerve. One changes where you live, the other your pay and work.",
    ],
    stay: "local",
    options: [
      {
        id: "move",
        label: ["接受迁岗，重新安排住处", "Accept the move and rearrange your home"],
        effects: [["补贴 ¥20,000，搬家 ¥12,000，关系 −5", "Grant ¥20,000, moving ¥12,000, people −5"]],
      },
      {
        id: "local",
        label: ["留下做本地维护", "Stay in local maintenance"],
        effects: [["工资 −25%", "Pay −25%"]],
      },
      {
        id: "end",
        label: ["不签新合同，结束这份工作", "Sign neither and end this job"],
        effects: [["重新找工作", "Look for new work"]],
      },
    ],
    apply(s, j, option, year) {
      if (option === "move") {
        income(s.assets, j, yuan(20000), "relocation-grant");
        expense(s.assets, j, yuan(12000), "moving");
        changeProps(s, { relationships: -5 });
      } else if (option === "local") s.salaryFactor *= 0.75;
      else {
        s.role = "unemployed";
        s.flags.jobLost = year;
        changeProps(s, { happiness: -4 });
      }
    },
  },
};
const partnerName = (s       )       => s.family.partnerName ?? ["对方", "your partner"];
const parentWord = (_s       , c             )       =>
  sample(c.seed, 0, "older-parent") < 0.5 ? ["父亲", "Your father"] : ["母亲", "Your mother"];
export const choices           = [
  {
    id: "world",
    track: "world",
    due: (s, c) =>
      s.role === "employed" && !asked(s, "world") && c.year >= (c.mode === "parallel" ? BRANCH_YEAR + 1 : 2031),
    title: (_s, c) => worldJobs[c.world].title,
    body: (_s, c) => worldJobs[c.world].body,
    options: (_s, c) =>
      worldJobs[c.world].options.map((o) => ({
        id: o.id,
        label: o.label,
        costs: [],
        effects: o.effects,
        stay: o.id === worldJobs[c.world].stay,
      })),
    apply(s, j, c, pick) {
      const job = worldJobs[c.world];
      if (!job.options.some((o) => o.id === pick.option)) throw new Error("无效选择 / Invalid option");
      job.apply(s, j, pick.option, c.year);
      const label = job.options.find((o) => o.id === pick.option)?.label ?? job.title;
      return [story(`choice-world-${c.world}-${pick.option}`, [`你选择：${label[0]}。`, `You chose: ${label[1]}.`])];
    },
  },
  {
    id: "bridge",
    track: "world",
    due(s, c) {
      if (c.mode !== "parallel" || asked(s, "bridge")) return false;
      const chain = hiddenChain(c.worldSeed);
      return chain.unlocked && c.year >= chain.warEnd + 1;
    },
    title: () => ["桥的这一端", "This end of the bridge"],
    body: () => [
      "试验室让你先听一段普通雨声，再决定要不要用可断开的接口，与另一位志愿者交换“听到它的感觉”。协议最后一行是：拒绝，不影响你的其他权利。",
      "The lab asks you to listen to ordinary rain first, then decide whether to use a disconnectable interface to share how it sounds with another volunteer. The last line reads: saying no does not affect any of your other rights.",
    ],
    options: () => [
      {
        id: "bridge",
        label: ["同意一次可中止的桥接体验", "Agree to one session you can stop"],
        costs: [],
        effects: [["一次体验，随时可以断开", "One session; you can disconnect at any time"]],
      },
      {
        id: "witness",
        stay: true,
        label: ["不桥接，参加口述记录", "Decline and join the oral history"],
        costs: [],
        effects: [["留下这个时代的口述记录", "Leave an oral record of the era"]],
      },
    ],
    apply(s, _j, c, pick) {
      s.flags[pick.option === "bridge" ? "bridge" : "witness"] = c.year;
      return [
        story("hidden-after", [
          "试验结束后，记录员给每个人留下一段不公开的个人时间。新的世界仍然需要关门，也仍然需要敲门。",
          "After the trial the recorder left everyone some private time. The new world still needs closed doors, and still needs knocking.",
        ]),
      ];
    },
  },
  {
    id: "crash",
    track: "money",
    repeat: true,
    due: (s, c) =>
      s.crash === "ask" &&
      (s.flags.previousStockReturn ?? 0) < -crashThreshold &&
      s.assets.stocks > 0 &&
      again(s, "crash", 2, c.year),
    title: (s) => [
      `去年指数跌了 ${Math.round(-(s.flags.previousStockReturn ?? 0) * 100)}%，现在怎么办？`,
      `The index fell ${Math.round(-(s.flags.previousStockReturn ?? 0) * 100)}% last year. What now?`,
    ],
    body: (s) => [
      `你的指数基金现在值 ${zh(money(s.assets.stocks))}。同事群里有人在晒清仓截图，也有人在问要不要加仓。也可以在「钱的计划」里定一条规则，以后不再问。`,
      `Your index fund is now worth ${en(money(s.assets.stocks))}. Some colleagues post screenshots of selling out, others ask about buying more. You can also set a rule in the money plan and not be asked again.`,
    ],
    options: (s) => [
      {
        id: "hold",
        stay: true,
        label: ["不动，继续定投", "Hold and keep investing"],
        costs: [["¥0", "¥0"]],
        effects: [["账面亏损留在账上，等以后的行情", "The paper loss stays; later years decide"]],
      },
      {
        id: "add",
        label: ["再投入一笔：存款的三成", "Add 30% of deposits"],
        costs: [[`约 ${zh(money(Math.round(s.assets.deposits * 0.3)))}`, `About ${en(money(Math.round(s.assets.deposits * 0.3)))}`]],
        effects: [["按现在的低价买入，以后涨跌都更大", "Buys at today's lower price; bigger swings either way"]],
        blocked: s.assets.deposits < yuan(20000) ? ["存款不够", "Not enough in deposits"] : null,
      },
      {
        id: "sell",
        label: ["全部卖出，转成存款", "Sell everything into deposits"],
        costs: [["卖出费用约 0.5%", "About 0.5% in selling costs"]],
        effects: [["亏损就此锁定，之后的涨跌与你无关", "Locks in the loss; later moves pass you by"]],
      },
    ],
    apply(s, j, c, pick) {
      if (pick.option === "add") {
        transfer(s.assets, j, "deposits", "stocks", Math.round(s.assets.deposits * 0.3), "index-purchase");
        s.flags.addedOnDip = c.year;
      } else if (pick.option === "sell") {
        expense(s.assets, j, Math.round(s.assets.stocks * 0.005), "investment-fees");
        transfer(s.assets, j, "stocks", "deposits", s.assets.stocks, "panic-sale");
        s.flags.panic = c.year;
      }
      return [
        story(
          `choice-crash-${pick.option}`,
          pick.option === "add"
            ? ["你又投入了一笔。买入那天，你没再打开行情软件。", "You added more and did not open the market app again that day."]
            : pick.option === "sell"
              ? ["你全部卖出，钱回到了存款里。晚上睡得踏实了，账户也停在了这一天。", "You sold everything back into deposits. You slept better; the account stopped on that day."]
              : nth(s, c, "crash", [
                  [["你什么也没做，定投照常扣款。", "You did nothing; the monthly investment carried on."], ["你把行情软件挪到了手机的最后一页，定投照常扣款。", "You moved the market app to the last page of your phone; the monthly investment carried on."]],
                  [[
                    "又是一个跌得很深的年份。这一次你连行情软件都没打开。",
                    "Another deep fall. This time you did not even open the market app.",
                  ], ["又跌了。你翻出上次大跌时写的备忘：别动。你照做了。", "Another fall. You found the note you wrote last time: don't touch it. You didn't."]],
                ]),
        ),
      ];
    },
  },
  {
    id: "parents",
    track: "family",
    due: (s, c) => s.family.parentsBorn !== null && c.year - s.family.parentsBorn >= 68 && !asked(s, "parents"),
    title: (s, c) => [`${zh(parentWord(s, c))}住院了，怎么照顾？`, `${en(parentWord(s, c))} is in hospital. Who cares for them?`],
    body: (s, c) => [
      `${zh(parentWord(s, c))}${c.year - (s.family.parentsBorn ?? c.year)} 岁，在${s.hometown || "老家"}做了心脏支架手术。手术顺利，出院后要有人照看三个月。医保报销后，自付部分约 ${zh(money(price(s, yuan(15000))))}。`,
      `${en(parentWord(s, c))}, ${c.year - (s.family.parentsBorn ?? c.year)}, had a heart stent fitted in ${s.hometown || "your hometown"}. It went well, but someone must help for three months. After insurance, about ${en(money(price(s, yuan(15000))))} is left to pay.`,
    ],
    facts: ["lifeExpectancy2024"],
    options(s) {
      const care = price(s, yuan(18000));
      if (s.place === "hometown")
        return [
          {
            id: "nearby",
            stay: true,
            label: ["下班后轮流过去照看", "Take turns after work"],
            costs: [["自付医疗费", "The medical co-pay"]],
            effects: [["健康 −2，关系 +5", "Health −2, people +5"]],
          },
          {
            id: "hire",
            label: ["请护工", "Hire a carer"],
            costs: [[`护工约 ${zh(money(care))}`, `About ${en(money(care))} for a carer`]],
            effects: [["关系 +1", "People +1"]],
          },
          {
            id: "together",
            label: ["搬过去住一段时间", "Move in with them for a while"],
            costs: [["生活费多两成，持续一年", "Living costs +20% for a year"]],
            effects: [["关系 +8，快乐 −1", "People +8, happiness −1"]],
          },
        ];
      return [
        {
          id: "leave",
          label: ["请一个月假回去照顾", "Take a month off to care for them"],
          costs: [["这一年少一个月工资", "One month's pay this year"]],
          effects: [["关系 +6，健康 −2", "People +6, health −2"]],
        },
        {
          id: "hire",
          stay: true,
          label: ["请护工，每周视频", "Hire a carer and call weekly"],
          costs: [[`护工约 ${zh(money(care))}`, `About ${en(money(care))} for a carer`]],
          effects: [["关系 +1", "People +1"]],
        },
        {
          id: "bring",
          label: ["接到身边一起住", "Bring them to live with you"],
          costs: [["生活费多四成，持续一年", "Living costs +40% for a year"]],
          effects: [["关系 +8，快乐 −2", "People +8, happiness −2"]],
        },
      ];
    },
    apply(s, j, c, pick) {
      expense(s.assets, j, price(s, yuan(15000)), "parents-medical");
      if (pick.option === "hire") {
        expense(s.assets, j, price(s, yuan(18000)), "care");
        s.family.care = "hired";
        changeProps(s, { relationships: 1 });
        return [
          story(
            "choice-parents-hire",
            oneOf(c, "parents-hire", [
              ["护工阿姨很细心，每天发一张饭菜的照片。你在周日视频时看到父母都胖了一点。", "The carer was attentive and sent a photo of every meal. On Sunday calls your parents looked a little better fed."],
              ["第一位护工做了两周就辞了，第二位会讲家乡话，父亲终于肯按时吃药。", "The first carer left after two weeks; the second spoke the local dialect, and your father finally took his pills on time."],
              ["你每晚和护工通一次电话，记下血压和饭量。三个月后，本子写满了半本。", "You phoned the carer every evening and noted blood pressure and meals; after three months half a notebook was full."],
            ]),
          ),
        ];
      }
      s.flags.caregiver = c.year;
      if (pick.option === "leave") {
        s.flags.unpaidLeave = c.year;
        s.flags.unpaidMonths = 1;
        changeProps(s, { relationships: 6, health: -2 });
        return [
          story("choice-parents-leave", [
            "你请了一个月假回去。每天陪着下楼走两圈，第三周开始，走到了小区门口。",
            "You took a month off and went home. Each day you walked two laps together; by the third week you reached the estate gate.",
          ]),
        ];
      }
      if (pick.option === "nearby") {
        changeProps(s, { relationships: 5, health: -2 });
        return [
          story("choice-parents-nearby", [
            "你和家里人排了一张值班表，下班后轮流过去。三个月后，表撕下来时已经写满了。",
            "You and the family drew up a rota and took turns after work. When it came down three months later, it was full.",
          ]),
        ];
      }
      s.family.care = "together";
      s.flags.parentsTogether = c.year;
      changeProps(s, { relationships: 8, happiness: pick.option === "bring" ? -2 : -1 });
      return [
        story("choice-parents-together", [
          "你们住到了一起。早饭变得很早，电视的声音变得很大，晚上散步多了一个人。",
          "You moved in together. Breakfast got earlier, the television louder, and the evening walk had one more person.",
        ]),
      ];
    },
  },
  {
    id: "crossroads",
    track: "work",
    repeat: true,
    due: (_s, c) => c.offset > 0 && c.offset % 5 === 4,
    title: () => ["这一段，往哪里走？", "Where next?"],
    body: (s) => [
      `${s.age} 岁，你在${s.place === "hometown" ? s.hometown : s.city}。工作还在，日子也还算稳。是时候看看下一段了。`,
      `At ${s.age} you are in ${s.place === "hometown" ? s.hometown : s.city}. Work is steady enough. Time to look at the next stretch.`,
    ],
    options: (s) =>
      (Object.keys(decisionLabels)                  ).map((kind) => ({
        id: kind,
        label: decisionLabels[kind],
        costs: [careerCosts[kind]],
        effects: [],
        stay: kind === "stay",
        blocked: eligibility(s, kind),
        step:
          kind === "business"
            ? ("funding"         )
            : kind === "invest"
              ? ("investment"         )
              : kind === "custom"
                ? ("custom"         )
                : undefined,
      })),
    apply(s, j, c, pick) {
      return applyDecision(
        s,
        j,
        c.market,
        {
          kind: pick.option                ,
          ...(pick.funding ? { funding: pick.funding } : {}),
          ...(pick.investment ? { investment: pick.investment } : {}),
          ...(pick.custom ? { custom: pick.custom } : {}),
        },
        c.seed,
      );
    },
  },
  {
    id: "home",
    track: "home",
    repeat: true,
    due(s, c) {
      if (c.offset < 2 || s.age > 55 || !["rent", "shared", "family"].includes(s.housing)) return false;
      if (!again(s, "home", 4, c.year)) return false;
      return (
        minimumDown(s, homePrice(s, "city")) !== null ||
        (s.place === "city" && s.hometown !== s.city && minimumDown(s, homePrice(s, "hometown")) !== null)
      );
    },
    title: (s) =>
      s.place === "city" && s.hometown && s.hometown !== s.city
        ? [`继续在${s.city}租，还是买房？`, `Keep renting in ${s.city}, or buy?`]
        : ["继续租，还是买房？", "Keep renting, or buy?"],
    body: (s) => [
      `房东说明年要涨租。你算了算：${s.city}的房子总价约 ${zh(money(homePrice(s, "city")))}${s.place === "city" && s.hometown && s.hometown !== s.city ? `，${s.hometown}的约 ${zh(money(homePrice(s, "hometown")))}` : ""}。`,
      `Your landlord is raising the rent. A home in ${s.city} costs about ${en(money(homePrice(s, "city")))}${s.place === "city" && s.hometown && s.hometown !== s.city ? `; in ${s.hometown}, about ${en(money(homePrice(s, "hometown")))}` : ""}.`,
    ],
    facts: ["lpr2026"],
    options(s) {
      const list           = [
        {
          id: "rent",
          stay: true,
          label: ["继续租，接着攒首付", "Keep renting and saving"],
          costs: [
            s.housing === "family"
              ? ["住家里，不付房租", "Living with family, no rent"]
              : [`房租每月 ${zh(money(s.rent))}`, `Rent ${en(money(s.rent))} a month`],
          ],
          effects: [["工作和住处都不变", "Same job, same home"]],
        },
      ];
      const city = homePrice(s, "city");
      const blocked = (total        )              => {
        if (minimumDown(s, total) !== null) return null;
        const gap = Math.round(total * 0.22) + reserve - liquid(s.assets) - s.assets.fund;
        return [`首付两成和税费还差 ${zh(money(gap))}`, `Short of the 20% deposit and fees by ${en(money(gap))}`];
      };
      list.push({
        id: "city",
        label: [`在${s.city}买一套 ${homeSize(s, "city")}㎡`, `Buy ${homeSize(s, "city")} m² in ${s.city}`],
        costs: [
          [`总价约 ${zh(money(city))}`, `About ${en(money(city))}`],
          ["首付两成起，另付约 2% 税费", "20% deposit or more, plus about 2% fees"],
        ],
        effects: [
          [`房贷利率 ${(mortgageRate * 100).toFixed(1)}%，月供在下一步算`, `Mortgage at ${(mortgageRate * 100).toFixed(1)}%; payment set next`],
          ["通勤更远", "A longer commute"],
        ],
        step: "mortgage",
        blocked: blocked(city),
      });
      if (s.place === "city" && s.hometown && s.hometown !== s.city) {
        const home = homePrice(s, "hometown");
        const pay = Math.round((s.salary * tiers[s.homeTier].wage) / tiers[s.tier].wage);
        list.push({
          id: "hometown",
          label: [`回${s.hometown}，买房并换工作`, `Move back to ${s.hometown}, buy and change jobs`],
          costs: [
            [`总价约 ${zh(money(home))}`, `About ${en(money(home))}`],
            ["首付两成起，另付约 2% 税费和搬家", "20% deposit or more, fees and moving"],
          ],
          effects: [
            [`年薪约变为 ${zh(money(pay))}`, `Salary becomes about ${en(money(pay))}`],
            ["离父母近，不再付房租", "Close to your parents, no more rent"],
          ],
          step: "mortgage",
          blocked: blocked(home),
        });
      }
      return list;
    },
    apply(s, j, c, pick) {
      if (pick.option === "city") return buyHome(s, j, c, "city", pick);
      if (pick.option === "hometown") return buyHome(s, j, c, "hometown", pick);
      return [
        story(
          "choice-home-rent",
          nth(s, c, "home", [
            [[
              "你续了租约，把首付目标写在了记账软件的第一页。",
              "You renewed the lease and put the deposit target on the first page of your budgeting app.",
            ], ["你和房东续签了两年，顺手把首付目标设成了手机壁纸。", "You renewed for two more years and set the deposit target as your phone wallpaper."]],
            [[
              "又到续租的时候。你没再去看样板间，只把首付进度截了张图发给自己。",
              "Lease renewal again. You skipped the show flats and sent yourself a screenshot of the deposit fund instead.",
            ], ["中介又打来电话推荐新盘。你说先不看了，挂掉后把每月存钱的数额提高了一点。", "An agent called about a new development again. You said not now, then nudged your monthly savings up a little."]],
            [[
              "你不再把租房当成过渡。房东换了新的热水器，阳台上多了第三盆花。",
              "You stopped treating renting as a stopgap. The landlord fitted a new water heater; a third pot of flowers went out on the balcony.",
            ], ["你给出租屋换了窗帘和书架。朋友来做客，说这里看起来像住了很多年。", "You put up new curtains and shelves in the rented flat. A visiting friend said it looked lived-in for years."]],
          ]),
        ),
      ];
    },
  },
  {
    id: "marry",
    track: "family",
    repeat: true,
    due: (s, c) =>
      s.family.partner === "dating" &&
      s.family.since !== null &&
      c.year - s.family.since >= 2 &&
      s.age <= 55 &&
      again(s, "marry", 3, c.year),
    title: () => ["两个人的日历，要不要变成一个家？", "Two calendars: make them one home?"],
    body: (s, c) => [
      `你和${zh(partnerName(s))}在一起第 ${c.year - (s.family.since ?? c.year)} 年。家里开始问什么时候办事，你们自己也在看两个人住的房子。`,
      `You and ${en(partnerName(s))} have been together ${c.year - (s.family.since ?? c.year)} years. Family is asking about a wedding, and the two of you are looking at places for two.`,
    ],
    facts: ["marriage2024"],
    options(s) {
      const wedding = price(s, yuan(60000));
      return [
        {
          id: "marry",
          label: ["领证，办一场小婚礼", "Marry with a small wedding"],
          costs: [[`婚礼约 ${zh(money(wedding))}，份子钱回来一半`, `Wedding about ${en(money(wedding))}; gifts return half`]],
          effects: [["收入合在一起，关系 +8，快乐 +6", "Pooled income; people +8, happiness +6"]],
          blocked: liquid(s.assets) < wedding ? ["现金不够办婚礼", "Not enough cash for the wedding"] : null,
        },
        {
          id: "live",
          label: ["先住到一起，不领证", "Move in together without marrying"],
          costs: [["换大一点的房子，房租每月多 ¥800", "A bigger flat; rent +¥800 a month"]],
          effects: [["对方分担生活费，关系 +4", "Shared costs; people +4"]],
        },
        {
          id: "keep",
          stay: true,
          label: ["维持现状，各住各的", "Keep things as they are"],
          costs: [["¥0", "¥0"]],
          effects: [["三年后再说", "Revisit in three years"]],
        },
        {
          id: "part",
          label: ["分开", "Break up"],
          costs: [["¥0", "¥0"]],
          effects: [["关系 −6，快乐 −8", "People −6, happiness −8"]],
        },
      ];
    },
    apply(s, j, c, pick) {
      const name = partnerName(s);
      if (pick.option === "marry") {
        const wedding = price(s, yuan(60000));
        expense(s.assets, j, wedding, "wedding");
        income(s.assets, j, Math.round(wedding / 2), "wedding-gifts");
        s.family.partner = "married";
        s.family.partnerCanSupport = true;
        s.flags.married = c.year;
        if (s.housing === "rent") s.rent += price(s, yuan(800));
        changeProps(s, { relationships: 8, happiness: 6 });
        return [
          story("choice-marry", [
            `你和${zh(name)}领了证。婚礼只请了二十几个人，敬酒的时候两个人都没忍住笑场。`,
            `You and ${en(name)} married. Only about twenty people came, and you both laughed through the toast.`,
          ]),
        ];
      }
      if (pick.option === "live") {
        s.family.partner = "living";
        if (s.housing === "rent") s.rent += price(s, yuan(800));
        changeProps(s, { relationships: 4, happiness: 3 });
        return [
          story("choice-live", [
            "你们搬到了一起。冰箱上多了一张轮值表，第一周就因为谁倒垃圾改了两次。",
            "You moved in together. A rota appeared on the fridge and was revised twice in the first week over the rubbish.",
          ]),
        ];
      }
      if (pick.option === "part") {
        s.family.partner = "none";
        s.family.partnerName = null;
        s.family.since = null;
        s.flags.breakup = c.year;
        changeProps(s, { relationships: -6, happiness: -8 });
        return [
          story("choice-part", [
            "你们好好地谈了一次，决定分开。共同的朋友没有选边，周末的时间突然空了出来。",
            "You talked it through and decided to part. Mutual friends did not take sides; your weekends suddenly emptied.",
          ]),
        ];
      }
      changeProps(s, { relationships: 1 });
      return [
        story(
          "choice-keep",
          nth(s, c, "marry", [
            [[
              "你们决定先不改变什么，各自的钥匙还是各自拿着。",
              "You decided to change nothing for now; each of you kept your own keys.",
            ], ["你们约好明年再说。周五晚上照旧一起吃饭，周日各回各家。", "You agreed to talk again next year. Friday dinners as usual; Sunday nights at separate homes."]],
            [[
              "家里又问起来，你们还是说再等等。回去的路上，两个人都没再提这件事。",
              "Family asked again and you both said “later”. Neither of you brought it up on the way home.",
            ], ["亲戚的婚礼上，有人问你们什么时候。你们相视一笑，没有回答。", "At a cousin's wedding someone asked when it would be your turn. You exchanged a smile and said nothing."]],
            [[
              "你们不再把这件事当成待办。各住各的，也一起过了好几个春节。",
              "You stopped treating it as a to-do. Two homes, and several New Years spent together all the same.",
            ], ["两套钥匙、两个冰箱，你们已经很习惯。旅行的照片里，总是两个人。", "Two sets of keys, two fridges; you are used to it. In the travel photos it is always the two of you."]],
          ]),
        ),
      ];
    },
  },
  {
    id: "child",
    track: "family",
    repeat: true,
    due: (s, c) =>
      s.family.partner === "married" &&
      (s.flags.married === undefined || c.year - (s.flags.married ?? 0) >= 1) &&
      s.age <= 43 &&
      s.family.children.length === 0 &&
      s.flags.childFree === undefined &&
      again(s, "child", 3, c.year),
    title: () => ["要不要孩子？", "Have a child?"],
    body: (s) => [
      `${zh(partnerName(s))}把一张育儿开销的表格发给你，最后一行写着“我们再聊聊”。`,
      `${en(partnerName(s))} sent you a spreadsheet of childcare costs; the last row says “let's talk again”.`,
    ],
    options(s) {
      const yearly = price(s, tiers[s.tier].child);
      return [
        {
          id: "now",
          label: ["现在要一个", "Have a child now"],
          costs: [
            ["生育一次约 ¥2 万", "About ¥20,000 for the birth"],
            [`之后每年约 ${zh(money(yearly))}`, `Then about ${en(money(yearly))} a year`],
          ],
          effects: [["快乐 +6，关系 +4，头两年健康 −", "Happiness +6, people +4, tired for two years"]],
        },
        {
          id: "later",
          stay: true,
          label: ["过几年再说", "Talk again in a few years"],
          costs: [["¥0", "¥0"]],
          effects: [["三年后再问", "Asked again in three years"]],
        },
        {
          id: "none",
          label: ["不要孩子，把这件事说开", "No children; settle it together"],
          costs: [["¥0", "¥0"]],
          effects: [["不再问这件事", "Not asked again"]],
        },
      ];
    },
    apply(s, j, c, pick) {
      if (pick.option === "now") {
        s.family.children.push(c.year);
        expense(s.assets, j, price(s, yuan(20000)), "birth");
        changeProps(s, { happiness: 6, relationships: 4, health: -3 });
        return [
          story("choice-child", [
            "孩子在秋天出生。头三个月你们轮流睡觉，手机相册里一半是同一张脸。",
            "Your child was born in the autumn. For three months you took turns sleeping; half the phone's photos are the same face.",
          ]),
        ];
      }
      if (pick.option === "none") {
        s.flags.childFree = c.year;
        changeProps(s, { relationships: 1 });
        return [
          story("choice-childfree", [
            "你们决定不要孩子，也决定下次家里再问时由你们一起回答。",
            "You decided not to have children, and to answer together the next time family asks.",
          ]),
        ];
      }
      return [
        story(
          "choice-child-later",
          nth(s, c, "child", [
            [["你们把这件事放到几年后再谈，先把眼前的日子过稳。", "You agreed to revisit it in a few years and steady the present first."], ["你们去听了一场育儿讲座，回来的路上决定再等两年。", "You went to a talk on raising children and decided on the way home to wait two more years."]],
            [[
              "那张育儿开销的表格又更新了一版。你们看完，还是决定再等等。",
              "The childcare spreadsheet got another update. You read it together and decided to wait again.",
            ], ["朋友的孩子满月，你们抱了很久。回家后谁也没提那张表格。", "At a friend's baby's first-month party you both held the baby a long time. At home neither mentioned the spreadsheet."]],
          ]),
        ),
      ];
    },
  },
  {
    id: "insurance",
    track: "health",
    due: (s, c) => c.offset >= 1 && !s.insurance.medical && s.age <= 60 && !asked(s, "insurance"),
    title: () => ["医保之外，要不要再买一份？", "Beyond public health cover, buy more?"],
    body: () => [
      "体检报告上多了一个上箭头。做保险的朋友发来两份方案，说现在买比过几年便宜。",
      "A check-up flagged one value. A friend who sells insurance sent two plans, saying they are cheaper now than in a few years.",
    ],
    options(s) {
      const m = premiums.medical(s.age);
      const both = m + premiums.critical(s.age);
      const cash = liquid(s.assets);
      return [
        {
          id: "none",
          stay: true,
          label: ["先不买", "Not now"],
          costs: [["每年 ¥0", "¥0 a year"]],
          effects: [["住院的自付部分靠存款", "Hospital co-pays come from savings"]],
        },
        {
          id: "medical",
          label: ["百万医疗险", "Hospital insurance"],
          costs: [[`每年约 ${zh(money(m))}，随年龄上涨`, `About ${en(money(m))} a year, rising with age`]],
          effects: [["一年自付超过 1 万的部分可以报", "Covers co-pays above ¥10,000 a year"]],
          blocked: cash < m ? ["现金不够付保费", "Not enough cash for the premium"] : null,
        },
        {
          id: "both",
          label: ["百万医疗 + 重疾险", "Hospital + critical illness"],
          costs: [[`每年约 ${zh(money(both))}，重疾险交 20 年`, `About ${en(money(both))} a year; 20 years of premiums`]],
          effects: [
            ["一年自付超过 1 万的部分可以报", "Covers co-pays above ¥10,000 a year"],
            ["确诊约定重疾一次赔 30 万", "Pays ¥300,000 once on a covered diagnosis"],
          ],
          blocked: cash < both ? ["现金不够付保费", "Not enough cash for the premiums"] : null,
        },
      ];
    },
    apply(s, _j, c, pick) {
      if (pick.option === "none")
        return [
          story(
            "choice-insurance-none",
            oneOf(c, "insurance-none", [
              ["你决定先不买。体检报告收进抽屉，复查定在半年后。", "You decided not to buy for now. The report went into a drawer; the follow-up is in six months."],
              ["你把两份方案都存进了收藏夹，回了朋友一句“再看看”。那天晚上你早睡了一小时。", "You saved both plans and told your friend “I'll think about it”. That night you went to bed an hour early."],
              ["你算了算医保能报的部分，决定这笔钱先留在存款里，复查时再说。", "You worked out what public insurance would cover and kept the money in savings until the follow-up."],
            ]),
          ),
        ];
      s.insurance.medical = true;
      if (pick.option === "both") {
        s.insurance.critical = true;
        s.insurance.criticalPremium = premiums.critical(s.age);
        s.insurance.criticalUntil = c.year + 19;
      }
      return [
        story(
          `choice-insurance-${pick.option}`,
          pick.option === "both"
            ? [
                "你买了百万医疗险和一份交二十年的重疾险。每年多出的这笔钱，换来一件不用反复想的事。",
                "You bought hospital insurance and a twenty-year critical-illness policy. The yearly cost bought one less thing to keep worrying about.",
              ]
            : [
                "你买了一份百万医疗险，保费每年从工资卡里自动扣。",
                "You bought hospital insurance; the premium comes out of your salary account each year.",
              ],
        ),
      ];
    },
  },
  {
    id: "car",
    track: "far",
    due: (s, c) => !s.car && c.offset >= 3 && s.age <= 65 && liquid(s.assets) >= yuan(60000) && !asked(s, "car"),
    title: () => ["要不要买车？", "Buy a car?"],
    body: (s) =>
      s.place === "hometown"
        ? [
            `${s.hometown}的公交二十分钟一班。周末带父母去医院复查，打车来回要一个多小时。`,
            `Buses in ${s.hometown} come every twenty minutes. Taking your parents to a hospital check-up by taxi takes over an hour each way.`,
          ]
        : [
            "新办公室离地铁站一公里。同事在团购一款纯电车，便宜三万。",
            "The new office is a kilometre from the metro. Colleagues are buying an electric car together for ¥30,000 off.",
          ],
    facts: ["vehicles2024"],
    options(s) {
      const total = price(s, yuan(150000));
      const cash = liquid(s.assets);
      const monthly = annuity(Math.round(total * 0.7), 0.04, 3);
      return [
        {
          id: "none",
          stay: true,
          label: ["不买，坐公交和打车", "No car; buses and taxis"],
          costs: [
            [
              `每年约 ${zh(money(price(s, tiers[s.tier].transit)))}`,
              `About ${en(money(price(s, tiers[s.tier].transit)))} a year`,
            ],
          ],
          effects: [["每天多走一些路", "More walking every day"]],
        },
        {
          id: "cash",
          label: ["全款买纯电车", "Buy an electric car outright"],
          costs: [
            [`${zh(money(total))}`, `${en(money(total))}`],
            ["每年用车约 ¥7,000，车价每年折旧约 15%", "About ¥7,000 a year to run; loses about 15% a year"],
          ],
          effects: [["出行省时，快乐 +3", "Saves time; happiness +3"]],
          blocked: cash < total + reserve ? ["现金不够全款", "Not enough cash to pay outright"] : null,
        },
        {
          id: "loan",
          label: ["首付三成，贷款三年", "30% down, three-year loan"],
          costs: [
            [`首付 ${zh(money(Math.round(total * 0.3)))}`, `${en(money(Math.round(total * 0.3)))} down`],
            [`月供约 ${zh(money(monthly))}，年利率 4%（游戏设定）`, `About ${en(money(monthly))} a month at 4% (game setting)`],
          ],
          effects: [["出行省时，快乐 +3", "Saves time; happiness +3"]],
          blocked: cash < total * 0.3 + reserve ? ["首付不够", "Not enough for the down payment"] : null,
        },
      ];
    },
    apply(s, j, c, pick) {
      if (pick.option === "none")
        return [
          story(
            "choice-car-none",
            oneOf(c, "car-none", [
              ["你没买车，把常用的三条公交线路收藏在手机首页。", "You did not buy a car and pinned your three usual bus routes to your phone's home screen."],
              ["你办了一张共享汽车的会员卡，一年用了九次，比养一辆车省心。", "You joined a car-sharing scheme instead and used it nine times that year; easier than owning one."],
              ["你给旧自行车换了新胎和车灯，下雨天就打车。", "You fitted new tyres and lights to the old bicycle, and took taxis when it rained."],
            ]),
          ),
        ];
      const total = price(s, yuan(150000));
      if (pick.option === "loan") {
        const loan = Math.round(total * 0.7);
        borrow(s.assets, j, loan, "carLoan", "car-loan");
        s.carLoan = { rate: 0.04, payment: annuity(loan, 0.04, 3), months: 36 };
      }
      if (s.assets.cash < total) transfer(s.assets, j, "deposits", "cash", total - s.assets.cash, "withdrawal");
      transfer(s.assets, j, "cash", "car", total, "car-purchase");
      s.car = true;
      s.flags.carBought = c.year;
      changeProps(s, { happiness: 3 });
      return [
        story("choice-car-buy", [
          "提车那天下着小雨。你在车里坐了一会儿，先把座椅调到了最舒服的位置。",
          "It drizzled the day you picked up the car. You sat in it for a while and set the seat just right first.",
        ]),
      ];
    },
  },
  {
    id: "far",
    track: "far",
    due: (s, c) => c.offset >= 5 && s.age <= 55 && liquid(s.assets) >= yuan(80000) && !asked(s, "far"),
    title: () => ["要不要去远方？", "Go somewhere far?"],
    body: () => [
      "朋友从冰岛寄来一张明信片，背面写着“你也该来看看”。公司刚好开放了一个外派名额。",
      "A friend sent a postcard from Iceland: “you should come and see”. Your company just opened a one-year posting abroad.",
    ],
    options(s) {
      const trip = price(s, yuan(60000));
      return [
        {
          id: "stay",
          stay: true,
          label: ["照常上班，每年短途", "Carry on with short trips"],
          costs: [["¥0", "¥0"]],
          effects: [["一切照旧", "Nothing changes"]],
        },
        {
          id: "journey",
          label: ["休三个月，长途旅行", "Take three months for a long journey"],
          costs: [
            [`旅费约 ${zh(money(trip))}`, `About ${en(money(trip))} for the trip`],
            ["这一年少三个月工资", "Three months' pay this year"],
          ],
          effects: [["快乐 +10，健康 +3", "Happiness +10, health +3"]],
          blocked: liquid(s.assets) < trip + reserve ? ["现金不够", "Not enough cash"] : null,
        },
        {
          id: "posting",
          label: ["申请外派一年", "Apply for the year abroad"],
          costs: [["离家一年", "A year away from home"]],
          effects: [["这一年工资 +25%，知识 +6，关系 −6", "Pay +25% this year, knowledge +6, people −6"]],
          blocked: s.role !== "employed" ? ["需要在职", "Requires a job"] : null,
        },
      ];
    },
    apply(s, j, c, pick) {
      if (pick.option === "journey") {
        expense(s.assets, j, price(s, yuan(60000)), "travel");
        if (s.role === "employed") {
          s.flags.unpaidLeave = c.year;
          s.flags.unpaidMonths = 3;
        }
        s.flags.journey = c.year;
        changeProps(s, { happiness: 10, health: 3, relationships: s.family.partner === "none" ? 0 : 2 });
        return [
          story("choice-far-journey", [
            "你在一条看不到尽头的公路边停下车。手机没有信号，你把这一页记在了纸上。",
            "You stopped by a road with no end in sight. There was no signal, so you wrote this page on paper.",
          ]),
        ];
      }
      if (pick.option === "posting") {
        s.flags.posting = c.year;
        changeProps(s, { knowledge: 6, relationships: -6 });
        return [
          story("choice-far-posting", [
            "外派的城市冬天很长。你学会了用当地话点咖啡，也学会了在时差里给家里打电话。",
            "Winter was long in the posting city. You learned to order coffee in the local language and to call home across time zones.",
          ]),
        ];
      }
      return [
        story(
          "choice-far-stay",
          oneOf(c, "far-stay", [
            ["你把明信片贴在了显示器旁边，说等明年。", "You stuck the postcard beside your monitor and said: next year."],
            ["外派名额给了隔壁组的同事。你帮对方整理了交接文档，送行那天喝了两杯。", "The posting went to a colleague next door. You helped with the handover notes and had two drinks at the farewell."],
            ["你把攒下的假期换成了两次周末短途，冰岛先放进了以后的清单。", "You turned the saved leave into two weekend trips and put Iceland on the someday list."],
          ]),
        ),
      ];
    },
  },
];
export const choiceById = new Map(choices.map((c) => [c.id, c]));
export const choiceKey = (choice        , year        ) => (choice.repeat ? `${choice.id}-${year}` : choice.id);
export const choiceIdOf = (key        ) => key.replace(/-\d{4}$/, "");
/** Validates a pick against the options available now; returns the reason it cannot be taken, or null. */
export function rejectPick(choice        , s       , c             , pick      )                {
  const option = choice.options(s, c).find((o) => o.id === pick.option);
  if (!option) return "无效选择 / Invalid option";
  if (option.blocked) return `${option.blocked[0]} / ${option.blocked[1]}`;
  if (option.step === "mortgage") {
    const total = homePrice(s, pick.option === "hometown" ? "hometown" : "city");
    const min = minimumDown(s, total);
    if (
      pick.down === undefined ||
      pick.years === undefined ||
      !downOptions.includes(pick.down       ) ||
      !yearOptions.includes(pick.years      ) ||
      min === null ||
      pick.down < min
    )
      return "无效的房贷设置 / Invalid mortgage settings";
  }
  if (option.step === "funding" && !["self", "loan"].includes(pick.funding ?? ""))
    return "请选择资金来源 / Choose funding";
  if (option.step === "investment" && !["bonds", "index"].includes(pick.investment ?? ""))
    return "请选择投资方向 / Choose an investment";
  if (option.step === "custom" && !["creative", "learning", "community"].includes(pick.custom ?? ""))
    return "请选择路线 / Choose a route";
  return null;
}
/** Defaults used when the line picks for itself (the baseline, peers and missing picks). */
export function defaultPick(choice        , s       , c             , option        )       {
  const pick       = { option: option.id };
  if (option.step === "mortgage") {
    const total = homePrice(s, option.id === "hometown" ? "hometown" : "city");
    pick.down = Math.max(0.3, minimumDown(s, total) ?? 0.4);
    pick.years = 30;
  }
  if (option.step === "funding") pick.funding = liquid(s.assets) >= yuan(70000) ? "self" : "loan";
  if (option.step === "investment") pick.investment = "index";
  if (option.step === "custom") pick.custom = "creative";
  return rejectPick(choice, s, c, pick) ? { option: choice.options(s, c).find((o) => o.stay)?.id ?? option.id } : pick;
}
export { downOptions, yearOptions };
