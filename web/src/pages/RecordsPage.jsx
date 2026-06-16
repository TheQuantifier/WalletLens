export default function RecordsPage() {
  return (
    <>
      <div id="header"></div>
      
      
        <main className="main">
      
          {/* ========================================================
               EXPENSES SECTION
          ========================================================= */}
          <section className="records-section">
      
            <div className="records-header">
              <div className="records-title">
                <h1>Expenses</h1>
                <p className="subtle">Search, filter, sort, and export your expense transactions.</p>
              </div>
      
              <div className="records-actions">
                <button className="btn" id="btnAddExpense" type="button">Add Expense</button>
                <button className="btn btn--primary" id="btnExportExpenses" type="button">Export</button>
              </div>
            </div>
      
            {/* Filters */}
            <div className="card records-subsection">
              <form id="filtersForm">
      
                <div className="records-filters-grid">
      
                  <label>
                    <span>Search</span>
                    <input type="text" id="q" name="q" placeholder="Category or note…" autoComplete="off" />
                  </label>
      
                  <label>
                    <span>Category</span>
                    <select id="category" name="category">
                      <option value="">All</option>
                    </select>
                  </label>
      
                  <label>
                    <span>Min Date</span>
                    <input type="date" id="minDate" name="minDate" />
                  </label>
      
                  <label>
                    <span>Max Date</span>
                    <input type="date" id="maxDate" name="maxDate" />
                  </label>
      
                  <label>
                    <span>Min Amount</span>
                    <input type="number" id="minAmt" name="minAmt" step="0.01" min="0" inputMode="decimal" placeholder="0.00" />
                  </label>
      
                  <label>
                    <span>Max Amount</span>
                    <input type="number" id="maxAmt" name="maxAmt" step="0.01" min="0" inputMode="decimal" placeholder="9999.99" />
                  </label>
      
                  <label>
                    <span>Rows per page</span>
                    <select id="pageSize" name="pageSize">
                      <option selected>5</option>
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                  </label>
      
                </div>
      
                <div className="flex" style={{ "gap": "1rem" }}>
                  <button type="submit" className="btn btn--primary">Apply</button>
                  <button type="button" className="btn btn--link" id="btnClear">Clear</button>
                </div>
      
              </form>
            </div>
      
            <p id="recordsStatusExpense" className="status-banner subtle is-hidden" aria-live="polite"></p>
      
            {/* Table */}
            <div className="records-table records-subsection">
              <div className="table-wrap card">
                <table className="txn-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="expense" data-sort-key="date">
                          Date <span className="sort-arrow" data-arrow-for="expense:date">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="expense" data-sort-key="type">
                          Type <span className="sort-arrow" data-arrow-for="expense:type">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="expense" data-sort-key="category">
                          Category <span className="sort-arrow" data-arrow-for="expense:category">↕</span>
                        </button>
                      </th>
                      <th className="num">
                        <button type="button" className="records-sort-btn records-sort-btn--num" data-sort-table="expense" data-sort-key="amount">
                          Amount <span className="sort-arrow" data-arrow-for="expense:amount">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="expense" data-sort-key="note">
                          Note <span className="sort-arrow" data-arrow-for="expense:note">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="expense" data-sort-key="origin">
                          Origin <span className="sort-arrow" data-arrow-for="expense:origin">↕</span>
                        </button>
                      </th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="recordsTbody" aria-live="polite">
                    <tr><td colSpan="7" className="subtle">Loading…</td></tr>
                  </tbody>
                </table>
              </div>
      
              <nav className="records-pager">
                <button className="btn" id="prevPageExpense" type="button" disabled>← Prev</button>
                <span id="pageInfoExpense" className="subtle">Page 1 of 1</span>
                <button className="btn" id="nextPageExpense" type="button" disabled>Next →</button>
              </nav>
            </div>
      
          </section>
      
          {/* ========================================================
               INCOME SECTION
          ========================================================= */}
          <section className="records-section">
      
            <div className="records-header">
              <div className="records-title">
                <h1>Income</h1>
                <p className="subtle">Search, filter, sort, and export your income transactions.</p>
              </div>
      
              <div className="records-actions">
                <button className="btn" id="btnAddIncome" type="button">Add Income</button>
                <button className="btn btn--primary" id="btnExportIncome" type="button">Export</button>
              </div>
            </div>
      
            {/* Filters */}
            <div className="card records-subsection">
              <form id="filtersFormIncome">
      
                <div className="records-filters-grid">
      
                  <label>
                    <span>Search</span>
                    <input type="text" id="qIncome" name="qIncome" placeholder="Category or note…" autoComplete="off" />
                  </label>
      
                  <label>
                    <span>Category</span>
                    <select id="categoryIncome" name="categoryIncome">
                      <option value="">All</option>
                    </select>
                  </label>
      
                  <label>
                    <span>Min Date</span>
                    <input type="date" id="minDateIncome" name="minDateIncome" />
                  </label>
      
                  <label>
                    <span>Max Date</span>
                    <input type="date" id="maxDateIncome" name="maxDateIncome" />
                  </label>
      
                  <label>
                    <span>Min Amount</span>
                    <input type="number" id="minAmtIncome" name="minAmtIncome" step="0.01" min="0" inputMode="decimal" placeholder="0.00" />
                  </label>
      
                  <label>
                    <span>Max Amount</span>
                    <input type="number" id="maxAmtIncome" name="maxAmtIncome" step="0.01" min="0" inputMode="decimal" placeholder="99999.99" />
                  </label>
      
                  <label>
                    <span>Rows per page</span>
                    <select id="pageSizeIncome" name="pageSizeIncome">
                      <option selected>5</option>
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                  </label>
      
                </div>
      
                <div className="flex" style={{ "gap": "1rem" }}>
                  <button type="submit" className="btn btn--primary">Apply</button>
                  <button type="button" className="btn btn--link" id="btnClearIncome">Clear</button>
                </div>
      
              </form>
            </div>
      
            <p id="recordsStatusIncome" className="status-banner subtle is-hidden" aria-live="polite"></p>
      
            {/* Table */}
            <div className="records-table records-subsection">
              <div className="table-wrap card">
                <table className="txn-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="income" data-sort-key="date">
                          Date <span className="sort-arrow" data-arrow-for="income:date">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="income" data-sort-key="type">
                          Type <span className="sort-arrow" data-arrow-for="income:type">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="income" data-sort-key="category">
                          Category <span className="sort-arrow" data-arrow-for="income:category">↕</span>
                        </button>
                      </th>
                      <th className="num">
                        <button type="button" className="records-sort-btn records-sort-btn--num" data-sort-table="income" data-sort-key="amount">
                          Amount <span className="sort-arrow" data-arrow-for="income:amount">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="income" data-sort-key="note">
                          Note <span className="sort-arrow" data-arrow-for="income:note">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="records-sort-btn" data-sort-table="income" data-sort-key="origin">
                          Origin <span className="sort-arrow" data-arrow-for="income:origin">↕</span>
                        </button>
                      </th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="recordsTbodyIncome" aria-live="polite">
                    <tr><td colSpan="7" className="subtle">Loading…</td></tr>
                  </tbody>
                </table>
              </div>
      
              <nav className="records-pager">
                <button className="btn" id="prevPageIncome" type="button" disabled>← Prev</button>
                <span id="pageInfoIncome" className="subtle">Page 1 of 1</span>
                <button className="btn" id="nextPageIncome" type="button" disabled>Next →</button>
              </nav>
            </div>
      
          </section>
      
          {/* ========================================================
               ADD/EDIT MODALS
          ========================================================= */}
      
          {/* Add Expense Modal */}
          <div id="addExpenseModal" className="modal hidden">
            <div className="modal-content">
              <h2>Add New Expense</h2>
      
              <form id="expenseForm" className="txn-form">
                <div className="form-row">
                  <label><span>Date</span><input type="date" id="expenseDate" name="expenseDate" required /></label>
                  <label><span>Amount</span><input type="number" id="expenseAmount" name="expenseAmount" step="0.01" min="0" inputMode="decimal" required /></label>
                </div>
      
                <div className="form-row">
                  <label>
                    <span>Category</span>
                    <select id="expenseCategory" name="expenseCategory" required>
                      <option value="" disabled selected>Select a category</option>
                    </select>
                  </label>
                  <div className="custom-category-list" id="expenseCustomCategories" aria-live="polite"></div>
                </div>
      
                <div className="form-row">
                  <label><span>Notes</span><input type="text" id="expenseNotes" name="expenseNotes" autoComplete="off" /></label>
                </div>
      
                <div className="form-row form-row--compact">
                  <label className="checkbox-inline">
                    <input type="checkbox" id="applyRulesExpense" defaultChecked />
                    <span>Apply rules to this record</span>
                  </label>
                </div>
      
                <div className="modal-actions">
                  <button type="submit" className="btn btn--primary">Save Expense</button>
                  <button type="button" className="btn" id="cancelExpenseBtn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
      
          {/* Add Income Modal */}
          <div id="addIncomeModal" className="modal hidden">
            <div className="modal-content">
              <h2>Add New Income</h2>
      
              <form id="incomeForm" className="txn-form">
                <div className="form-row">
                  <label><span>Date</span><input type="date" id="incomeDate" name="incomeDate" required /></label>
                  <label><span>Amount</span><input type="number" id="incomeAmount" name="incomeAmount" step="0.01" min="0" inputMode="decimal" required /></label>
                </div>
      
                <div className="form-row">
                  <label>
                    <span>Category</span>
                    <select id="incomeCategory" name="incomeCategory" required>
                      <option value="" disabled selected>Select a category</option>
                    </select>
                  </label>
                  <div className="custom-category-list" id="incomeCustomCategories" aria-live="polite"></div>
                </div>
      
                <div className="form-row">
                  <label><span>Notes</span><input type="text" id="incomeNotes" name="incomeNotes" autoComplete="off" /></label>
                </div>
      
                <div className="form-row form-row--compact">
                  <label className="checkbox-inline">
                    <input type="checkbox" id="applyRulesIncome" defaultChecked />
                    <span>Apply rules to this record</span>
                  </label>
                </div>
      
                <div className="modal-actions">
                  <button type="submit" className="btn btn--primary">Save Income</button>
                  <button type="button" className="btn" id="cancelIncomeBtn">Cancel</button>
                </div>
              </form>
            </div>
          </div>
      
          {/* ========================================================
               DELETE RECORD MODAL  (NEW)
          ========================================================= */}
          <div id="deleteRecordModal" className="modal hidden">
            <div className="modal-content">
              <h2>Delete Record</h2>
              <p id="deleteRecordText">
                This record is linked to an uploaded receipt.
              </p>
      
              <div className="modal-actions">
                <button id="btnDeleteRecordOnly" className="btn btn--danger" type="button">Delete Record</button>
                <button id="btnDeleteRecordAndReceipt" className="btn btn--warning" type="button">Delete Record & Receipt</button>
                <button id="btnCancelDeleteRecord" className="btn" type="button">Cancel</button>
              </div>
            </div>
          </div>
      
          <div id="receiptItemsModal" className="modal hidden" aria-labelledby="receiptItemsTitle">
            <div className="modal-content">
              <h2 id="receiptItemsTitle">Receipt Items</h2>
              <p id="receiptItemsSubtitle" className="subtle">Line items saved for this receipt.</p>
      
              <div id="receiptItemsStatus" className="status-banner subtle is-hidden" aria-live="polite"></div>
      
              <div className="receipt-items-panel">
                <div className="receipt-items-header">
                  <span>Item</span>
                  <span>Price</span>
                </div>
                <div id="receiptItemsList" className="receipt-items-list" aria-live="polite">
                  <p className="subtle">Loading…</p>
                </div>
              </div>
      
              <div className="modal-actions">
                <button id="btnCloseReceiptItems" className="btn" type="button">Close</button>
              </div>
            </div>
          </div>
      
          {/* ========================================================
               CUSTOM CATEGORY MODAL
          ========================================================= */}
          <div id="customCategoryModal" className="modal hidden">
            <div className="modal-content">
              <h2>Add Custom Category</h2>
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
      
        </main>
      
        <div id="footer"></div>
        
      
      
        {/* Scripts */}
    </>
  );
}
