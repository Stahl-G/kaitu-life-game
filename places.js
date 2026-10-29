import { yuan } from "./finance.js";
                                       
                                                                       
                               
              
                                            
               
                                                    
                    
                   
                                                            
                 
                                                              
               
                                          
                
                                                         
                  
                                                          
                        
 
/** City prices and wage multipliers are authored GAME SETTINGS for broad city types, not market data.
 * Only the rent deduction follows the published IIT standard (1,500 / 1,100 / 800 per month). */
export const tiers                             = {
  tier1: {
    label: ["一线城市", "Tier-1 city"],
    rent: yuan(5500),
    homePrice: yuan(58000),
    homeSize: 70,
    living: yuan(60000),
    wage: 1.35,
    child: yuan(42000),
    transit: yuan(6000),
    rentDeduction: yuan(1500),
  },
  newTier1: {
    label: ["新一线城市", "Large regional city"],
    rent: yuan(3600),
    homePrice: yuan(27000),
    homeSize: 85,
    living: yuan(48000),
    wage: 1.1,
    child: yuan(32000),
    transit: yuan(4800),
    rentDeduction: yuan(1500),
  },
  tier2: {
    label: ["二线城市", "Mid-sized city"],
    rent: yuan(2400),
    homePrice: yuan(15000),
    homeSize: 95,
    living: yuan(38000),
    wage: 0.95,
    child: yuan(25000),
    transit: yuan(3600),
    rentDeduction: yuan(1100),
  },
  tier3: {
    label: ["三四线城市", "Smaller city"],
    rent: yuan(1600),
    homePrice: yuan(8500),
    homeSize: 100,
    living: yuan(30000),
    wage: 0.8,
    child: yuan(19000),
    transit: yuan(3000),
    rentDeduction: yuan(800),
  },
  county: {
    label: ["县城或乡镇", "County town"],
    rent: yuan(1100),
    homePrice: yuan(5500),
    homeSize: 110,
    living: yuan(24000),
    wage: 0.68,
    child: yuan(15000),
    transit: yuan(2400),
    rentDeduction: yuan(800),
  },
};
const lists                     = [
  ["tier1", ["北京", "上海", "广州", "深圳", "beijing", "shanghai", "guangzhou", "shenzhen"]],
  [
    "newTier1",
    [
      "成都",
      "杭州",
      "重庆",
      "武汉",
      "苏州",
      "西安",
      "南京",
      "长沙",
      "天津",
      "郑州",
      "东莞",
      "青岛",
      "昆明",
      "宁波",
      "合肥",
      "chengdu",
      "hangzhou",
      "chongqing",
      "wuhan",
      "suzhou",
      "xi'an",
      "xian",
      "nanjing",
      "changsha",
      "tianjin",
      "zhengzhou",
      "dongguan",
      "qingdao",
      "kunming",
      "ningbo",
      "hefei",
    ],
  ],
  [
    "tier2",
    [
      "佛山",
      "沈阳",
      "无锡",
      "济南",
      "厦门",
      "福州",
      "温州",
      "哈尔滨",
      "石家庄",
      "大连",
      "南宁",
      "泉州",
      "金华",
      "贵阳",
      "常州",
      "长春",
      "南昌",
      "南通",
      "嘉兴",
      "徐州",
      "惠州",
      "太原",
      "台州",
      "绍兴",
      "珠海",
      "中山",
      "烟台",
      "兰州",
      "海口",
      "乌鲁木齐",
      "呼和浩特",
      "扬州",
      "foshan",
      "shenyang",
      "wuxi",
      "jinan",
      "xiamen",
      "fuzhou",
      "harbin",
      "dalian",
      "nanning",
      "guiyang",
      "changchun",
      "nanchang",
      "taiyuan",
      "lanzhou",
      "haikou",
    ],
  ],
];
/** Broad city type from a free-text place name. An empty name uses the middle setting; a city outside
 * the lists is treated as a smaller city. `known` is false whenever the type is a guess. */
export function tierOf(place        )                                 {
  const name = place.trim().toLowerCase();
  if (!name) return { tier: "tier2", known: false };
  for (const [tier, names] of lists) if (names.some((n) => name.includes(n))) return { tier, known: true };
  if (/[县镇乡村]|county|town|village/.test(name)) return { tier: "county", known: true };
  return { tier: "tier3", known: false };
}
