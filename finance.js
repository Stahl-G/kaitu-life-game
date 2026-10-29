/** All balances and journal amounts are integer fen (1 RMB = 100 fen). */
export const yuan = (value        ) => Math.round(value * 100);
export const assetAccounts = ["cash", "deposits", "bonds", "stocks", "property", "car", "fund"]         ;
export const liabilityAccounts = ["debt", "mortgage", "carLoan"]         ;
                                                   
                                                           
                                        
                               
               
                   
                
                 
                   
                                          
              
                                                                                                      
               
                                                      
               
                   
                  
                       
 
                        
                
                                                     
                 
 
                          
                  
                   
                  
                  
                        
 
export function emptyBalance()               {
  return {
    cash: 0,
    deposits: 0,
    bonds: 0,
    stocks: 0,
    property: 0,
    car: 0,
    fund: 0,
    debt: 0,
    mortgage: 0,
    carLoan: 0,
    interestRate: 0.065,
  };
}
export const netWorth = (b              ) =>
  assetAccounts.reduce((n, k) => n + b[k], 0) - liabilityAccounts.reduce((n, k) => n + b[k], 0);
export const liquid = (b              ) => b.cash + b.deposits;
/** Monthly payment of an equal-instalment loan (等额本息). */
export function annuity(principal        , rate        , years        ) {
  const r = rate / 12;
  const n = years * 12;
  return Math.round(r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n));
}
export function openJournal(b              )          {
  return { opening: netWorth(b), closing: netWorth(b), entries: [], arrears: 0, principalPaid: 0 };
}
export function income(b              , j         , requested        , label        , to        = "cash") {
  const amount = Math.max(0, Math.round(requested));
  b[to] += amount;
  j.entries.push({ label, kind: "income", amount });
}
export function transfer(b              , j         , from       , to       , requested        , label        ) {
  const amount = Math.min(b[from], Math.max(0, Math.round(requested)));
  b[from] -= amount;
  b[to] += amount;
  j.entries.push({ label, kind: "transfer", amount });
  return amount;
}
export function borrow(
  b              ,
  j         ,
  requested        ,
  liability            = "debt",
  label = "loan",
) {
  const amount = Math.max(0, Math.round(requested));
  b.cash += amount;
  b[liability] += amount;
  j.entries.push({ label, kind: "transfer", amount });
}
function makeCash(b              , j         , amount        ) {
  if (b.cash < amount) transfer(b, j, "deposits", "cash", amount - b.cash, "withdrawal");
}
export function expense(b              , j         , requested        , label        ) {
  const amount = Math.max(0, Math.round(requested));
  makeCash(b, j, amount);
  const unpaid = Math.max(0, amount - b.cash);
  b.debt += unpaid;
  b.cash = Math.max(0, b.cash - amount);
  j.arrears += unpaid;
  j.entries.push({ label, kind: "expense", amount });
}
/** Pays scheduled principal from cash and deposits above `reserve`; the unpaid part stays owed and counts as arrears. */
export function repay(
  b              ,
  j         ,
  requested        ,
  reserve = 0,
  liability            = "debt",
) {
  const due = Math.min(b[liability], Math.max(0, Math.round(requested)));
  const paid = Math.min(due, Math.max(0, liquid(b) - reserve));
  makeCash(b, j, paid);
  b.cash -= paid;
  b[liability] -= paid;
  j.principalPaid += paid;
  j.arrears += due - paid;
  j.entries.push({
    label: liability === "debt" ? "principal" : `${liability}-principal`,
    kind: "transfer",
    amount: paid,
  });
  return paid;
}
export function assetReturn(b              , j         , asset                        , rate        ) {
  const gain = Math.max(-b[asset], Math.round(b[asset] * rate));
  b[asset] += gain;
  j.entries.push({ label: asset, kind: "return", amount: gain });
}
export function closeJournal(b              , j         ) {
  j.closing = netWorth(b);
  const expected =
    j.opening +
    j.entries.reduce(
      (sum, e) => sum + (e.kind === "expense" ? -e.amount : e.kind === "transfer" ? 0 : e.amount),
      0,
    );
  if (expected !== j.closing) throw new Error(`Unbalanced journal: ${expected} != ${j.closing}`);
  if (
    Object.entries(b).some(
      ([key, value]) => key !== "interestRate" && (!Number.isSafeInteger(value) || value < 0),
    )
  )
    throw new Error("Invalid balance");
  return j;
}
