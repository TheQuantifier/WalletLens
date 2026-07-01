import { useEffect } from "react";
import { initBudgetingPage } from "../pageControllers/budgetingPageController.js";

export default function BudgetingPage() {
  useEffect(() => {
    initBudgetingPage();
    return () => {
      window.__walletlensBudgetingPageInitialized = false;
    };
  }, []);

  return (
    <>
      <div id="header"></div>
      
      
        <main className="main main--budgeting">
          <section className="budget-hero">
            <div>
              <h1 data-personal-text="Budgeting" data-business-text="Operating Budgets">Budgeting</h1>
              <p className="subtle" data-personal-text="Plan your spend, track actuals, and move unused funds to savings or another category." data-business-text="Plan organization expenses, compare actuals, and manage category allocations.">Plan your spend, track actuals, and move unused funds to savings or another category.</p>
            </div>
            <div className="budget-hero-meta">
              <div className="budget-selector">
                <label className="subtle" htmlFor="budgetSelector">Budget</label>
                <select id="budgetSelector" className="month-select" aria-label="Select budget"></select>
              </div>
              <button className="btn btn--primary" id="btnAddBudget" type="button">Add budget</button>
            </div>
          </section>

          <section className="budget-income-cards" aria-label="Salary totals after expenses">
            <article className="summary-card summary-card--total">
              <h2>Salary After Expenses (Yearly)</h2>
              <p id="planningSalaryYearly">-</p>
            </article>
            <article className="summary-card summary-card--remaining">
              <h2>Salary After Expenses (Monthly)</h2>
              <p id="planningSalaryMonthly">-</p>
            </article>
            <article className="summary-card summary-card--unused">
              <h2>Salary After Expenses (Weekly)</h2>
              <p id="planningSalaryWeekly">-</p>
            </article>
          </section>
      
          <section className="budget-summary" aria-label="Budget summary">
            <article className="summary-card summary-card--total">
              <h2>Total Budget</h2>
              <p id="summaryTotalBudget">—</p>
            </article>
            <article className="summary-card summary-card--spent">
              <h2>Spent</h2>
              <p id="summarySpent">—</p>
            </article>
            <article className="summary-card summary-card--remaining">
              <h2>Remaining</h2>
              <p id="summaryRemaining">—</p>
            </article>
            <article className="summary-card summary-card--unused">
              <h2>Unused (reallocatable)</h2>
              <p id="summaryUnused">—</p>
            </article>
          </section>
      
          <section className="budget-actions" aria-label="Budget actions">
            <div className="action-card">
              <h3>Move unused funds</h3>
              <p className="subtle">Unused amounts can be reallocated to another category or added to savings.</p>
              <div className="action-row">
                <button className="btn btn--primary" id="btnAddUnusedToSavings" type="button">Add unused to Savings</button>
                <div className="reallocate">
                  <label htmlFor="reallocateTarget" className="subtle">Or reallocate to</label>
                  <select id="reallocateTarget"></select>
                  <button className="btn" id="btnReallocateUnused" type="button">Move unused</button>
                </div>
              </div>
            </div>
            <p id="budgetStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </section>
      
          <section className="budget-table" aria-label="Category budgets">
            <div className="table-header">
              <h2>Categories</h2>
              <span className="pill" id="budgetPeriod" aria-live="polite">—</span>
              <div className="table-header-actions">
                <span className="subtle">Edit your budget to update remaining totals.</span>
                <button className="btn" id="btnResetBudgets" type="button">Reset defaults</button>
              </div>
            </div>
            <div className="table-wrap" role="region" aria-label="Budget table" tabIndex="0">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Percent</th>
                    <th className="num">Budget</th>
                    <th className="num">Spent</th>
                    <th className="num">Remaining</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody id="budgetTbody">
                  <tr><td colSpan="6" className="subtle">Loading budgets...</td></tr>
                </tbody>
              </table>
            </div>
            <div className="budget-table-actions">
              <button className="btn" id="btnAddBudgetCategory" type="button">Add category</button>
              <div className="budget-table-actions-right">
                <span id="budgetSaveStatus" className="status-banner subtle is-hidden budget-save-status" aria-live="polite"></span>
                <button className="btn" id="btnExportBudgetCsv" type="button">Export Budget</button>
                <button className="btn btn--primary" id="btnSaveBudget" type="button" disabled>Save budget</button>
                <button className="btn btn--danger" id="btnDeleteBudget" type="button">Delete budget</button>
              </div>
            </div>
          </section>
        </main>
      
        <div id="footer"></div>
        
      
      
        {/* ========== CUSTOM CATEGORY MODAL ========== */}
        <div id="addBudgetModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="addBudgetTitle">
          <div className="modal-content card">
            <h2 id="addBudgetTitle">Add Budget</h2>
            <p className="subtle">Choose a budget frequency and period.</p>
      
            <form id="addBudgetForm" className="txn-form">
              <div className="form-row">
                <label>
                  <span>Budget frequency</span>
                  <select id="budgetCadenceSelect" className="month-select" aria-label="Select budget frequency">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi-annually">Semi-Annually</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  <span>Period</span>
                  <select id="budgetMonthSelect" className="month-select" aria-label="Select budget period"></select>
                </label>
              </div>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">Create budget</button>
                <button type="button" className="btn" id="cancelAddBudgetBtn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      
        <div id="customCategoryModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="customCategoryTitle">
          <div className="modal-content card">
            <h2 id="customCategoryTitle">Add Custom Category</h2>
            <p className="subtle">Enter a name to add a custom category.</p>
      
            <form id="customCategoryForm" className="txn-form">
              <div className="form-row">
                <label><span>Category Name</span><input type="text" id="customCategoryInput" autoComplete="off" required /></label>
              </div>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">Save Category</button>
                <button type="button" className="btn" id="cancelCustomCategoryBtn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      
        {/* ========== DELETE BUDGET MODAL ========== */}
        <div id="deleteBudgetModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="deleteBudgetTitle">
          <div className="modal-content card">
            <h2 id="deleteBudgetTitle">Delete Budget</h2>
            <p className="subtle" id="deleteBudgetText"></p>
      
            <div className="modal-actions">
              <button type="button" className="btn btn--danger" id="confirmDeleteBudgetBtn">Yes, delete</button>
              <button type="button" className="btn" id="cancelDeleteBudgetBtn">No</button>
            </div>
          </div>
        </div>
    </>
  );
}
