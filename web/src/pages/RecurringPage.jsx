export default function RecurringPage() {
  return (
    <>
      <div id="header"></div>
      
        <main className="main main--recurring">
          <section className="recurring-hero">
            <div>
              <h1>Recurring Transactions</h1>
              <p className="subtle">
                Automate bills, subscriptions, and income. Upcoming occurrences are created automatically.
              </p>
            </div>
            <div className="recurring-hero-actions">
              <button className="btn btn--primary" id="btnCreateRecurring" type="button">Create Recurring</button>
            </div>
          </section>
      
          <section className="recurring-section">
            <div className="recurring-header">
              <h2>Active Schedules</h2>
              <p id="recurringStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </div>
            <div id="recurringEmpty" className="recurring-empty card">
              <h3>No recurring schedules yet</h3>
              <p className="subtle">Create your first schedule from a record or from scratch.</p>
              <button className="btn btn--primary" id="btnCreateRecurringEmpty" type="button">Create Recurring</button>
            </div>
            <div id="recurringList" className="recurring-grid"></div>
          </section>
      
          <section className="recurring-section">
            <div className="recurring-header">
              <h2>Upcoming</h2>
              <span className="subtle">Next 30 days</span>
            </div>
            <div className="card recurring-upcoming">
              <div id="recurringUpcoming" className="recurring-upcoming-list">
                <p className="subtle">Loading upcoming occurrences…</p>
              </div>
            </div>
          </section>
        </main>
      
        <div id="footer"></div>
      
        <div className="recurring-floating-menus" id="recurringFloatingMenus" aria-hidden="true">
          <div className="recurring-rule-menu hidden" id="recurringWeekdayMenu">
            <button type="button" data-weekday="1">Monday</button>
            <button type="button" data-weekday="2">Tuesday</button>
            <button type="button" data-weekday="3">Wednesday</button>
            <button type="button" data-weekday="4">Thursday</button>
            <button type="button" data-weekday="5">Friday</button>
            <button type="button" data-weekday="6">Saturday</button>
            <button type="button" data-weekday="0">Sunday</button>
          </div>
          <div className="recurring-rule-menu hidden" id="recurringMonthdayMenu"></div>
          <div className="recurring-yearly-menu hidden" id="recurringYearlyMenu">
            <div className="recurring-yearly-column">
              <div className="recurring-yearly-title">Month</div>
              <div className="recurring-yearly-list" id="recurringYearlyMonthList">
                <button type="button" data-year-month="01">January</button>
                <button type="button" data-year-month="02">February</button>
                <button type="button" data-year-month="03">March</button>
                <button type="button" data-year-month="04">April</button>
                <button type="button" data-year-month="05">May</button>
                <button type="button" data-year-month="06">June</button>
                <button type="button" data-year-month="07">July</button>
                <button type="button" data-year-month="08">August</button>
                <button type="button" data-year-month="09">September</button>
                <button type="button" data-year-month="10">October</button>
                <button type="button" data-year-month="11">November</button>
                <button type="button" data-year-month="12">December</button>
              </div>
            </div>
            <div className="recurring-yearly-column">
              <div className="recurring-yearly-title">Day</div>
              <div className="recurring-yearly-list" id="recurringYearlyDayList"></div>
            </div>
          </div>
        </div>
      
        {/* Create/Edit Modal */}
        <div id="recurringModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="recurringModalTitle">
          <div className="modal-content recurring-modal">
            <h2 id="recurringModalTitle">Create Recurring</h2>
      
            <form id="recurringForm" className="recurring-form">
              <div className="form-row">
                <label>
                  <span>Name</span>
                  <input type="text" id="recurringName" required placeholder="e.g., Netflix subscription" />
                </label>
                <label>
                  <span>Type</span>
                  <select id="recurringType">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Amount</span>
                  <input type="number" id="recurringAmount" step="0.01" min="0" required placeholder="0.00" />
                </label>
                <label>
                  <span>Category</span>
                  <select id="recurringCategory" required>
                    <option value="" disabled selected>Select a category</option>
                  </select>
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Note</span>
                  <input type="text" id="recurringNote" placeholder="Optional note" />
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Frequency</span>
                  <select id="recurringFrequency">
                    <option value="weekly">Weekly</option>
                    <option value="monthly" selected>Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <label>
                  <span id="recurringRuleLabel">Days of month</span>
                  <div className="recurring-rule-input">
                    <input
                      type="text"
                      id="recurringRuleInput"
                      placeholder="e.g., 1, 15"
                      autoComplete="off"
                    />
                    <button type="button" className="btn recurring-rule-add" id="recurringRuleAddBtn" aria-haspopup="dialog">+</button>
                  </div>
                  <div className="recurring-rule-selected subtle" id="recurringRuleSelected"></div>
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Start date</span>
                  <input type="date" id="recurringStartDate" required />
                </label>
                <label>
                  <span>End date (optional)</span>
                  <input type="date" id="recurringEndDate" />
                </label>
              </div>
      
              <div className="form-row form-row--compact">
                <label className="checkbox-inline">
                  <input type="checkbox" id="recurringActive" defaultChecked />
                  <span>Active</span>
                </label>
              </div>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" id="recurringSaveBtn">Save</button>
                <button type="button" className="btn" id="recurringCancelBtn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
    </>
  );
}
