import {               netWorth } from "./finance.js";
                                                             
// Remake's conditional event selection and weighted draw adapted from f04888e.
// Per-run state replaces upstream global Maps; MIT: vendor/remake/LICENSE.
import { check } from "./vendor/remake/condition.js";
import { pickWeight } from "./vendor/remake/random.js";
export { sample } from "./random.js";
                        
             
                                                                                       
                                    
                   
                         
                   
                                              
                                          
                                                    
                             
                                                                           
                                                  
 
function flat(s       ) {
  return {
    ...s.props,
    AGE: s.age,
    ASSETS: netWorth(s.assets),
    DEBT: s.assets.debt,
    EVT: new Set(Object.keys(s.lastEvents)),
  };
}
export function createEngine(definitions         ) {
  const catalog = new Map(definitions.map((e) => [e.id, e]));
  if (catalog.size !== definitions.length) throw new Error("Duplicate event ID");
  for (const e of definitions) {
    if (e.sensitive && !e.support?.length) throw new Error("Missing support resource");
    for (const b of e.branch ?? []) if (!catalog.has(b.event)) throw new Error("Missing branch target");
  }
  function eligible(e       , s       , m        ) {
    return (
      (s.lastEvents[e.id] === undefined || m.year - s.lastEvents[e.id] > e.cooldown) &&
      (!e.include || check(flat(s), e.include)) &&
      (!e.eligible || e.eligible(s, m))
    );
  }
  function weights(s       , m        ) {
    return definitions
      .filter((e) => eligible(e, s, m))
      .map((e) => [e.id, Math.max(1, Math.round(e.weight(s, m)))]         );
  }
  return {
    weights,
    next(s       , j         , m        , draw        )          {
      const candidates = weights(s, m);
      const id = pickWeight(candidates, (max = 1, min = 0) => Math.floor(draw * (max - min + 1)) + min);
      if (!id) throw new Error("No eligible event");
      const stories          = [];
      const visited = new Set        ();
      function trigger(key        ) {
        const e = catalog.get(key);
        // Branch targets are checked once in createEngine; a branch back to a visited event simply ends the chain.
        if (!e || visited.has(key)) return;
        visited.add(key);
        s.lastEvents[e.id] = m.year;
        e.apply?.(s, j, m);
        stories.push({
          id: e.id,
          text: typeof e.text === "function" ? e.text(s) : e.text,
          kind: "ordinary",
          ...(e.support ? { support: e.support } : {}),
          ...(e.facts ? { facts: e.facts } : {}),
        });
        for (const b of e.branch ?? []) {
          const next = catalog.get(b.event);
          if (next && check(flat(s), b.condition) && eligible(next, s, m)) {
            trigger(b.event);
            break;
          }
        }
      }
      trigger(id);
      return stories;
    },
  };
}
