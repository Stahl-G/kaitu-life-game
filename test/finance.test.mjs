import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annuity,
  assetReturn,
  borrow,
  closeJournal,
  emptyBalance,
  expense,
  income,
  netWorth,
  openJournal,
  repay,
  transfer,
  yuan,
} from "../dist/finance.js";
import { incomeTax, payroll } from "../dist/tax.js";
test("loans, purchases, sales and principal are transfers; unpaid bills become debt exactly once", () => {
  const b = { ...emptyBalance(), cash: yuan(10000), deposits: yuan(5000), interestRate: 0.06 };
  const j = openJournal(b);
  borrow(b, j, yuan(40000));
  transfer(b, j, "cash", "property", yuan(40000), "purchase");
  income(b, j, yuan(30000), "salary");
  expense(b, j, yuan(20000), "living");
  expense(b, j, yuan(2400), "interest");
  assetReturn(b, j, "property", -0.1);
  transfer(b, j, "property", "cash", b.property, "sale");
  repay(b, j, b.debt);
  closeJournal(b, j);
  assert.equal(netWorth(b), yuan(18600));
  const j2 = openJournal(b);
  expense(b, j2, yuan(50000), "living");
  closeJournal(b, j2);
  assert.equal(b.cash, 0);
  assert.equal(b.deposits, 0);
  assert.equal(b.debt, yuan(31400));
  assert.equal(j2.arrears, yuan(31400));
});
test("a mortgage is a liability: borrowing and repaying principal never change net worth", () => {
  // Equal instalments on ¥1,000,000 over 30 years at 3.1% are ¥4,270.16 a month.
  assert.equal(annuity(yuan(1000000), 0.031, 30), yuan(4270.16));
  const b = { ...emptyBalance(), cash: yuan(320000), fund: yuan(60000) };
  const j = openJournal(b);
  const start = netWorth(b);
  borrow(b, j, yuan(700000), "mortgage", "mortgage");
  transfer(b, j, "cash", "property", yuan(1000000), "home-purchase");
  assert.equal(netWorth(b), start);
  repay(b, j, yuan(15000), 0, "mortgage");
  assert.equal(b.mortgage, yuan(685000));
  assert.equal(netWorth(b), start);
  // Principal that cannot be paid stays owed and counts as arrears, without touching the reserve.
  const paid = repay(b, j, yuan(50000), b.cash + b.deposits - yuan(5000), "mortgage");
  assert.equal(paid, yuan(5000));
  assert.equal(j.arrears, yuan(45000));
  closeJournal(b, j);
});
test("payroll follows the published IIT table and deductions", () => {
  const p = payroll(yuan(200000), yuan(20000), [
    { label: "children", amount: yuan(24000) },
    { label: "mortgage-interest", amount: yuan(12000) },
  ]);
  // Social insurance 10.5% and housing fund 7% of salary; 220,000 − 60,000 − 21,000 − 14,000 − 36,000.
  assert.equal(p.social, yuan(21000));
  assert.equal(p.fund, yuan(14000));
  assert.equal(p.taxable, yuan(89000));
  assert.equal(p.tax, yuan(6380));
  assert.equal(p.net, yuan(220000 - 21000 - 14000 - 6380));
  // Bracket edges: the quick deductions keep the table continuous.
  assert.equal(incomeTax(yuan(36000)), yuan(1080));
  assert.equal(incomeTax(yuan(144000)), yuan(11880));
  assert.equal(incomeTax(yuan(1000000)), yuan(268080));
  assert.equal(incomeTax(0), 0);
  assert.equal(payroll(yuan(60000), 0).tax, 0);
});
