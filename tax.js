import { yuan } from "./finance.js";
/** Annual payroll under the published PRC rules for consolidated income: 60,000 basic deduction,
 * seven-bracket IIT table, special additional deductions at the 2023-08 standards.
 * Game simplifications: one employee social-insurance rate (pension 8% + medical 2% + unemployment 0.5%)
 * and one housing-fund rate on the whole salary, no contribution base caps, bonus taxed together with salary.
 * Not a tax calculator. */
export const payrollRules = {
  basicDeduction: yuan(60000),
  socialRate: 0.105,
  fundRate: 0.07,
  monthly: {
    child: yuan(2000),
    mortgageInterest: yuan(1000),
    // Shared cap for a non-only child; the game does not assume the player has no siblings.
    elderly: yuan(1500),
  },
};
const brackets                             = [
  [yuan(36000), 0.03, 0],
  [yuan(144000), 0.1, yuan(2520)],
  [yuan(300000), 0.2, yuan(16920)],
  [yuan(420000), 0.25, yuan(31920)],
  [yuan(660000), 0.3, yuan(52920)],
  [yuan(960000), 0.35, yuan(85920)],
  [Number.POSITIVE_INFINITY, 0.45, yuan(181920)],
];
export function incomeTax(taxable        ) {
  if (taxable <= 0) return 0;
  const [, rate, quick] = brackets.find(([cap]) => taxable <= cap) ?? brackets[brackets.length - 1];
  return Math.round(taxable * rate - quick);
}
                            
                
                 
 
                          
                 
                
                 
                                                                                
               
                          
                  
              
                                                                    
              
 
export function payroll(salary        , bonus        , deductions              = [])          {
  const social = Math.round(salary * payrollRules.socialRate);
  const fund = Math.round(salary * payrollRules.fundRate);
  const taxable = Math.max(
    0,
    salary +
      bonus -
      payrollRules.basicDeduction -
      social -
      fund -
      deductions.reduce((n, d) => n + d.amount, 0),
  );
  const tax = incomeTax(taxable);
  return { salary, bonus, social, fund, deductions, taxable, tax, net: salary + bonus - social - fund - tax };
}
