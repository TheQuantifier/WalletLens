import { useEffect } from "react";
import { initRulesPage } from "../pageControllers/rulesPageController.js";

export default function RulesPage() {
  useEffect(() => {
    initRulesPage();
    return () => {
      window.__walletlensRulesPageInitialized = false;
    };
  }, []);

  return (
    <>
      <div id="header"></div>
      
        <main className="main main--rules">
          <section className="rules-hero">
            <div>
              <h1>Rules Engine</h1>
              <p className="subtle">
                Automate categorization, tags, and consistency. Rules run on new records and can be applied in bulk.
              </p>
              <div className="rules-overview" aria-label="Rules overview">
                <div className="rules-overview-card">
                  <span className="rules-overview-label">Enabled</span>
                  <strong id="rulesEnabledCount">0</strong>
                </div>
                <div className="rules-overview-card">
                  <span className="rules-overview-label">Total Rules</span>
                  <strong id="rulesTotalCount">0</strong>
                </div>
                <div className="rules-overview-card rules-overview-card--wide">
                  <span className="rules-overview-label">How It Runs</span>
                  <strong>Higher priority first. Bulk apply updates past records.</strong>
                </div>
              </div>
            </div>
            <div className="rules-hero-actions">
              <button className="btn btn--primary" id="btnCreateRule" type="button">Create Rule</button>
              <button className="btn" id="btnApplyRules" type="button">Apply To Existing</button>
              <button className="btn btn--link rules-help-btn" id="btnRulesHelp" type="button">How rules work</button>
            </div>
          </section>
      
          <section className="rules-section">
            <div className="rules-header">
              <h2>Active Rules</h2>
              <p id="rulesStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </div>
            <div id="rulesEmpty" className="rule-empty card">
              <h3>No rules yet</h3>
              <p className="subtle">Create your first rule to automate categorization and tags.</p>
              <button className="btn btn--primary" id="btnCreateRuleEmpty" type="button">Create Rule</button>
            </div>
            <div id="rulesList" className="rules-grid"></div>
          </section>
        </main>
      
        <div id="footer"></div>
      
        {/* Create/Edit Rule Modal */}
        <div id="ruleModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="ruleModalTitle">
          <div className="modal-content rule-modal">
            <h2 id="ruleModalTitle">Create Rule</h2>
      
            <form id="ruleForm" className="rule-form">
              <div className="form-row">
                <label>
                  <span>Rule Name</span>
                  <input type="text" id="ruleName" name="ruleName" placeholder="e.g., Starbucks → Dining" required />
                </label>
                <label>
                  <span>Priority</span>
                  <input type="number" id="rulePriority" name="rulePriority" min="1" max="999" value="100" />
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Apply Mode</span>
                  <select id="ruleApplyMode" name="ruleApplyMode">
                    <option value="first">Stop after first match</option>
                    <option value="all">Apply all matching rules</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" id="ruleEnabled" name="ruleEnabled" defaultChecked />
                  <span>Rule enabled</span>
                </label>
              </div>
      
              <div className="rule-divider">
                <span>Conditions</span>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Type</span>
                  <select id="ruleType" name="ruleType">
                    <option value="any">Any</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label>
                  <span>Category</span>
                  <select id="ruleCategory" name="ruleCategory">
                    <option value="">Any</option>
                  </select>
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Note contains</span>
                  <input type="text" id="ruleNoteContains" name="ruleNoteContains" placeholder="e.g., Starbucks" />
                </label>
                <label>
                  <span>Origin</span>
                  <select id="ruleOrigin" name="ruleOrigin">
                    <option value="any">Any</option>
                    <option value="manual">Manual</option>
                    <option value="receipt">Receipt</option>
                    <option value="recurring">Recurring</option>
                    <option value="plaid">Plaid</option>
                  </select>
                </label>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Min Amount</span>
                  <input type="number" id="ruleAmountMin" name="ruleAmountMin" step="0.01" min="0" placeholder="0.00" />
                </label>
                <label>
                  <span>Max Amount</span>
                  <input type="number" id="ruleAmountMax" name="ruleAmountMax" step="0.01" min="0" placeholder="9999.99" />
                </label>
              </div>
      
              <div className="rule-divider">
                <span>Actions</span>
              </div>
      
              <div className="form-row">
                <label>
                  <span>Set Category</span>
                  <select id="actionCategory" name="actionCategory">
                    <option value="">No change</option>
                  </select>
                </label>
                <label>
                  <span>Add Tag / Note</span>
                  <input type="text" id="actionTag" name="actionTag" placeholder="e.g., #recurring" />
                </label>
              </div>
      
              <div className="rule-preview" aria-live="polite">
                <span className="rule-preview-label">Live Summary</span>
                <p id="ruleLiveSummary" className="subtle">Start adding conditions and actions to preview the rule.</p>
              </div>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" id="ruleSaveBtn">Save Rule</button>
                <button type="button" className="btn" id="ruleCancelBtn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      
        {/* Onboarding Modal */}
        <div id="rulesOnboardingModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="rulesOnboardingTitle">
          <div className="modal-content rule-modal">
            <h2 id="rulesOnboardingTitle">Welcome to Rules</h2>
            <p className="subtle">
              Rules automatically organize your records. When a record matches your conditions, the rule will apply actions like setting a category or adding a tag.
            </p>
            <ul className="rules-onboarding-list">
              <li><strong>Example:</strong> If note contains “Starbucks”, set category to Dining.</li>
              <li><strong>Apply mode:</strong> Stop after the first match or apply all matching rules.</li>
              <li><strong>Bulk apply:</strong> Use “Apply To Existing” to update past records.</li>
            </ul>
            <label className="checkbox-row checkbox-row--compact">
              <input type="checkbox" id="rulesOnboardingDontShow" />
              <span>Don’t show again</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn--primary" id="rulesOnboardingClose">Got it</button>
            </div>
          </div>
        </div>
    </>
  );
}
