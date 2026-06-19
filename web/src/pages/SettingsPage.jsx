import { useEffect } from "react";
import { initSettingsPage } from "../pageControllers/settingsPageController.js";

export default function SettingsPage() {
  useEffect(() => {
    initSettingsPage();
    return () => {
      window.__walletlensSettingsPageInitialized = false;
    };
  }, []);

  return (
    <>
      <div id="header"></div>
      
      
        <main className="main main--profile settings-container">
      
          {/* HERO */}
          <section className="profile-hero">
            <div className="title-wrap">
              <h1>Settings</h1>
              <p className="subtle" data-personal-text="Manage your application preferences" data-business-text="Manage your user preferences for this business workspace">Manage your application preferences</p>
            </div>
          </section>
      
          <div className="profile-grid">
      
            {/* GENERAL */}
            <section className="settings-card">
              <h2>General</h2>
      
              <div className="settings-row">
                <label>Dark Mode</label>
                <button className="settings-btn btn--primary" id="toggleDarkMode" type="button">Toggle</button>  
              </div>
      
              <div className="settings-row">
                <label>Language</label>
                <select className="settings-input" id="languageSelect">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
      
            </section>
      
            {/* FORMATTING */}
            <section className="settings-card">
              <h2>Formatting</h2>
      
              <div className="settings-row">
                <label>Time Zone</label>
                <select className="settings-input" id="timezoneSelect">
                  <option value="UTC-12:00">(UTC-12:00) Baker Island</option>
                  <option value="UTC-11:00">(UTC-11:00) Niue, Samoa</option>
                  <option value="UTC-10:00">(UTC-10:00) Hawaii</option>
                  <option value="UTC-09:00">(UTC-09:00) Alaska</option>
                  <option value="UTC-08:00">(UTC-08:00) Pacific Time (US & Canada)</option>
                  <option value="UTC-07:00">(UTC-07:00) Mountain Time (US & Canada)</option>
                  <option value="UTC-06:00">(UTC-06:00) Central Time (US & Canada)</option>
                  <option value="America/New_York">(EST) Eastern Time (US & Canada)</option>
                  <option value="UTC+00:00">(UTC+00:00) London, Lisbon</option>
                  <option value="UTC+01:00">(UTC+01:00) Berlin, Paris, Rome</option>
                  <option value="UTC+05:30">(UTC+05:30) India</option>
                  <option value="UTC+08:00">(UTC+08:00) Beijing, Singapore</option>
                  <option value="UTC+09:00">(UTC+09:00) Tokyo, Seoul</option>
                  <option value="UTC+10:00">(UTC+10:00) Sydney</option>
                  <option value="UTC+12:00">(UTC+12:00) Auckland</option>
                </select>
              </div>
      
              <div className="settings-row">
                <label>Currency Format</label>
                <select className="settings-input" id="currencySelect">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
      
              <div className="settings-row">
                <label>Number Format</label>
                <select className="settings-input" id="numberFormatSelect">
                  <option value="US">1,000.00</option>
                  <option value="EU">1.000,00</option>
                </select>
              </div>
      
              <div className="settings-row">
                <label>Default Dashboard View</label>
                <select className="settings-input" id="dashboardViewSelect">
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                   <option value="All Time">All Time</option>
                </select>
              </div>
      
              {/* SAVE BUTTON */}
              <div className="settings-row settings-actions">
                <button className="settings-btn btn--primary" id="saveSettingsBtn" type="button">Save Settings</button>
                <p id="settingsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            {/* NOTIFICATIONS */}
            <section className="settings-card">
              <h2>Notifications</h2>
      
              <div className="settings-row">
                <label>
                  Email Notifications
                  <input type="checkbox" id="notif_email" />
                </label>
              </div>
      
              <div className="settings-row">
                <label>
                  SMS Alerts
                  <input type="checkbox" id="notif_sms" />
                </label>
              </div>
            </section>
      
            <section className="settings-card">
              <h2>Exports</h2>
      
              <div className="settings-row">
                <label htmlFor="exportFormatSelect">Default Export Format</label>
                <select className="settings-input" id="exportFormatSelect">
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="google-sheets">Google Sheets</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
      
              <div className="settings-row">
                <label data-personal-text="Export All User Data" data-business-text="Export Business Workspace Data">Export All User Data</label>
                <div className="settings-actions-inline">
                  <button className="settings-btn btn--primary" id="exportAllDataBtn" type="button" data-personal-text="Export Full Account" data-business-text="Export Business Workspace">Export Full Account</button>
                </div>
                <p className="subtle" data-personal-text="Includes personal info, records, receipts, budgets, recurring schedules, rules, net worth, achievements, and activity." data-business-text="Includes organization records, receipts, budgets, recurring schedules, rules, balance-sheet data, and activity available to you.">Includes personal info, records, receipts, budgets, recurring schedules, rules, net worth, achievements, and activity.</p>
                <p id="exportAllStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            <div className="settings-split-row">
              {/* ACCOUNT */}
              <section className="settings-card">
                <h2>Account</h2>
      
                <div className="settings-row">
                  <label>Two-Factor Authentication (Email)</label>
                  <div className="settings-actions-inline">
                    <span id="twoFaStatus" className="subtle">Loading…</span>
                    <button className="settings-btn btn--primary" id="enableTwoFaBtn" type="button">Enable</button>
                    <button className="settings-btn btn--danger is-hidden" id="disableTwoFaBtn" type="button">Disable</button>
                  </div>
                </div>
      
                <div className="settings-row">
                  <label>Password</label>
                  <div className="settings-actions-inline">
                    <button className="settings-btn btn--primary" id="changePasswordBtn" type="button">Change Password</button>
                  </div>
                </div>
      
                <div className="settings-row is-hidden" id="googleConnectRow">
                  <label>Google Sign-In</label>
                  <div className="settings-actions-inline">
                    <span id="googleConnectStatus" className="subtle">Not connected</span>
                    <button className="settings-btn btn--primary" id="connectGoogleBtn" type="button">Connect Google</button>
                  </div>
                </div>
      
                <div className="settings-row personal-account-only">
                  <label>Delete Account</label>
                  <button className="settings-btn btn--danger" id="deleteAccountBtn" type="button">Delete</button>
                </div>

                <div className="settings-row business-account-only">
                  <label>Business Account</label>
                  <div className="settings-actions-inline">
                    <a className="settings-btn btn--primary org-admin-only is-hidden" href="/team">Manage Organization</a>
                    <span className="subtle">Personal account deletion is available after switching to Personal.</span>
                  </div>
                </div>
      
                <div className="settings-row">
                  <label>Account Access</label>
                  <div className="settings-actions-inline" style={{ "flexDirection": "column", "alignItems": "flex-start" }}>
                    <span id="accountAccessStatus" className="subtle">Loading…</span>
                    <span id="accountAccessMeta" className="subtle"></span>
                  </div>
                </div>
              </section>
      
              <section className="settings-card">
                <h2>Active Sessions</h2>
      
                <div className="settings-row">
                  <label>Signed-In Devices</label>
                  <div id="sessionsList" className="session-list">
                    <p className="subtle">Loading sessions…</p>
                  </div>
                </div>
      
                <div className="settings-row">
                  <label>Sign Out All Devices</label>
                  <button className="settings-btn btn--danger" id="signOutAllBtn" type="button">Sign Out All</button>
                </div>
              </section>
            </div>
      
          </div>
        </main>
      
        <div id="footer"></div>
        
      
      
        {/* DELETE ACCOUNT CONFIRM MODAL */}
        <div className="modal hidden" id="deleteAccountModal" aria-hidden="true">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="deleteAccountTitle">
            <h2 id="deleteAccountTitle">Delete Account</h2>
            <p className="subtle">This will permanently delete your account and data. This action cannot be undone.</p>
      
            <label>
              <span className="label">Type <strong>DELETE</strong> to confirm</span>
              <input id="deleteConfirmInput" type="text" autoComplete="off" placeholder="DELETE" />
            </label>
      
            <div className="modal-actions">
              <button className="btn btn--danger" id="confirmDeleteAccountBtn" type="button">Delete Account</button>
              <button className="btn" id="cancelDeleteAccountBtn" type="button">Cancel</button>
            </div>
      
            <p id="deleteAccountStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </div>
        </div>
      
        {/* SIGN OUT ALL CONFIRM MODAL */}
        <div className="modal hidden" id="signOutAllModal" aria-hidden="true">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="signOutAllTitle">
            <h2 id="signOutAllTitle">Sign Out All Devices</h2>
            <p className="subtle">Please re-enter your password to sign out of all devices.</p>
      
            <label>
              <span className="label">Password</span>
              <input id="signOutAllPassword" type="password" autoComplete="current-password" placeholder="Password" />
            </label>
      
            <div className="modal-actions">
              <button className="btn btn--danger" id="confirmSignOutAllBtn" type="button">Sign Out All</button>
              <button className="btn" id="cancelSignOutAllBtn" type="button">Cancel</button>
            </div>
      
            <p id="signOutAllStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </div>
        </div>
      
        {/* CHANGE PASSWORD MODAL */}
        <div className="modal hidden" id="passwordModal" aria-hidden="true">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="passwordModalTitle">
            <h2 id="passwordModalTitle">Change Password</h2>
            <p className="subtle" id="passwordModalSubtitle">Use a strong unique password for better security.</p>
      
            <form id="passwordForm" className="form-grid">
              <label className="span-2" id="currentPasswordRow">
                <span className="label">Current Password</span>
                <input id="currentPassword" type="password" autoComplete="current-password" required />
              </label>
      
              <label className="span-2">
                <span className="label">New Password</span>
                <input id="newPassword" type="password" autoComplete="new-password" required minLength="8" />
              </label>
      
              <label className="span-2">
                <span className="label">Confirm New Password</span>
                <input id="confirmPassword" type="password" autoComplete="new-password" required minLength="8" />
              </label>
      
              <label className="span-2 is-hidden" id="passwordTwoFaRow">
                <span className="label">2FA Code</span>
                <input
                  id="passwordTwoFaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                />
              </label>
      
              <div className="modal-actions span-2">
                <button type="button" className="btn" id="closePasswordModal">Cancel</button>
                <button type="submit" className="btn btn--primary" id="submitPasswordBtn">Update Password</button>
              </div>
            </form>
      
            <p id="passwordStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </div>
        </div>
      
        {/* 2FA ENABLE MODAL */}
        <div className="modal hidden" id="enableTwoFaModal" aria-hidden="true">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="enableTwoFaTitle">
            <h2 id="enableTwoFaTitle">Enable Two-Factor Authentication</h2>
            <p className="subtle">Enter the code sent to your email to enable 2FA.</p>
      
            <label>
              <span className="label">Verification Code</span>
              <input id="twoFaCodeInput" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" />
            </label>
      
            <div className="modal-actions">
              <button className="btn btn--primary" id="confirmEnableTwoFaBtn" type="button">Verify & Enable</button>
              <button className="btn" id="cancelEnableTwoFaBtn" type="button">Cancel</button>
            </div>
      
            <p id="enableTwoFaStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </div>
        </div>
      
        {/* 2FA DISABLE MODAL */}
        <div className="modal hidden" id="disableTwoFaModal" aria-hidden="true">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="disableTwoFaTitle">
            <h2 id="disableTwoFaTitle">Disable Two-Factor Authentication</h2>
            <p className="subtle">Enter your password to disable 2FA.</p>
      
            <label>
              <span className="label">Password</span>
              <input id="twoFaDisablePassword" type="password" autoComplete="current-password" placeholder="Password" />
            </label>
      
            <div className="modal-actions">
              <button className="btn btn--danger" id="confirmDisableTwoFaBtn" type="button">Disable 2FA</button>
              <button className="btn" id="cancelDisableTwoFaBtn" type="button">Cancel</button>
            </div>
      
            <p id="disableTwoFaStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
          </div>
        </div>
    </>
  );
}
