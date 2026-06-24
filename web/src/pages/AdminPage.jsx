import { useEffect } from "react";
import { initAdminPage } from "../pageControllers/adminPageController.js";
import { api } from "../../scripts/api.js";

const MAINTENANCE_PAGE_OPTIONS = [
  ["index", "Landing"],
  ["login", "Login"],
  ["register", "Register"],
  ["registerwho", "Account Type"],
  ["registerbusiness", "Business Registration"],
  ["acceptinvite", "Accept Invite"],
  ["home", "Home"],
  ["upload", "Upload"],
  ["records", "Records"],
  ["recurring", "Recurring"],
  ["rules", "Rules"],
  ["budgeting", "Budgeting"],
  ["reports", "Reports"],
  ["profile", "Profile"],
  ["settings", "Settings"],
  ["admin", "Admin"],
  ["team", "Team"],
  ["about", "About"],
  ["careers", "Careers"],
  ["help", "Help"],
  ["privacy", "Privacy Policy"],
  ["terms", "Terms"],
  ["timeout", "Timeout"],
  ["expired", "Expired"],
];

export default function AdminPage() {
  useEffect(() => {
    let active = true;
    api.auth.me().then(({ user }) => {
      if (!active) return;
      const platformRole = String(user?.platform_role || "user").toLowerCase();
      if (String(user?.role || "").toLowerCase() === "org_admin" && platformRole === "user") {
        if (window.__walletlensNavigate) window.__walletlensNavigate("/team");
        else window.location.href = "/team";
        return;
      }
      initAdminPage();
    }).catch(() => {
      if (active) initAdminPage();
    });
    return () => {
      active = false;
      window.__walletlensAdminPageInitialized = false;
    };
  }, []);

  return (
    <>
      <div id="header"></div>
      
        <main className="main admin-main">
          <section className="admin-hero">
            <div>
              <h1>Admin Console</h1>
              <p className="subtle">Oversee users, records, and global app configuration.</p>
            </div>
            <div className="admin-badge">Admin Only</div>
          </section>
      
          <section className="admin-grid">
            <section className="card admin-panel" id="statsPanel">
              <div className="admin-panel-header">
                <div>
                  <h2>Overview</h2>
                  <p className="subtle">Live totals across the platform.</p>
                </div>
              </div>
              <div className="admin-tags">
                <div className="admin-tag admin-tag--users">
                  <span className="admin-tag-label">Users</span>
                  <strong id="statsUsers">0</strong>
                </div>
                <div className="admin-tag admin-tag--records">
                  <span className="admin-tag-label">Records</span>
                  <strong id="statsRecords">0</strong>
                </div>
                <div className="admin-tag admin-tag--receipts">
                  <span className="admin-tag-label">Receipts</span>
                  <strong id="statsReceipts">0</strong>
                </div>
              </div>
              <p id="statsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </section>
      
            <section className="card admin-panel is-collapsed" id="usersPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button
                    className="admin-caret-toggle"
                    id="toggleUsersPanelCaret"
                    type="button"
                    aria-expanded="false"
                    aria-controls="usersPanelBody"
                    aria-label="Expand Users section"
                  >
                    &gt;
                  </button>
                  <div>
                    <h2>Users</h2>
                    <p className="subtle">Enter a username, name, or email to find a user and view related data.</p>
                  </div>
                </div>
                <div className="admin-actions">
                  <input
                    id="userSearch"
                    type="text"
                    placeholder="Enter username, name, or email"
                    autoComplete="off"
                    list="adminUserOptions"
                  />
                  <button className="btn btn--primary" id="userSearchBtn" type="button">Find User</button>
                  <button className="btn btn--primary" id="inviteMemberBtn" type="button" hidden>Invite Member</button>
                  <button className="btn btn--link" id="userClearBtn" type="button" aria-label="Clear selected user data">X</button>
                </div>
              </div>
              <div id="usersPanelBody">
              <datalist id="adminUserOptions"></datalist>
      
              <p id="usersStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>

              <section id="organizationInvitationsSection" className="admin-invitations is-hidden">
                <div className="admin-panel-header">
                  <div><h3>Member Invitations</h3><p className="subtle">Pending and previous invitations for your organization.</p></div>
                </div>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Email</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
                    <tbody id="organizationInvitationsTbody"><tr><td colSpan="4" className="subtle">No invitations.</td></tr></tbody>
                  </table>
                </div>
                <p id="organizationInvitationsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </section>
      
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" className="admin-sort-btn" data-table="users" data-key="name">
                          Name <span className="sort-arrow" data-arrow-for="users:name">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="admin-sort-btn" data-table="users" data-key="email">
                          Email <span className="sort-arrow" data-arrow-for="users:email">↕</span>
                        </button>
                      </th>
                      <th>
                        <button type="button" className="admin-sort-btn" data-table="users" data-key="role">
                          Role <span className="sort-arrow" data-arrow-for="users:role">↕</span>
                        </button>
                      </th>
                      <th>Status</th>
                      <th>Access Ends</th>
                      <th>
                        <button type="button" className="admin-sort-btn" data-table="users" data-key="created">
                          Created <span className="sort-arrow" data-arrow-for="users:created">↕</span>
                        </button>
                      </th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="usersTbody">
                    <tr><td colSpan="5" className="subtle">Loading…</td></tr>
                  </tbody>
                </table>
              </div>
              <nav className="admin-pager">
                <button className="btn" id="usersPrevPage" type="button" disabled>← Prev</button>
                <span id="usersPageInfo" className="subtle">Page 1 of 1</span>
                <button className="btn" id="usersNextPage" type="button" disabled>Next →</button>
              </nav>
              <section id="userDataSections" className="admin-grid is-hidden">
              <section className="card admin-panel" id="recordsPanel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Records</h2>
                    <p id="recordsContext" className="subtle">Search for a user to view records.</p>
                  </div>
                  <div className="admin-actions">
                    <select id="recordsType">
                      <option value="">All types</option>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <button className="btn btn--primary" id="recordsSearchBtn" type="button">Apply Filter</button>
                  </div>
                </div>
      
                <p id="recordsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
      
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="admin-sort-btn" data-table="records" data-key="date">
                            Date <span className="sort-arrow" data-arrow-for="records:date">↕</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="admin-sort-btn" data-table="records" data-key="userName">
                            User Name <span className="sort-arrow" data-arrow-for="records:userName">↕</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="admin-sort-btn" data-table="records" data-key="type">
                            Type <span className="sort-arrow" data-arrow-for="records:type">↕</span>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="admin-sort-btn" data-table="records" data-key="category">
                            Category <span className="sort-arrow" data-arrow-for="records:category">↕</span>
                          </button>
                        </th>
                        <th className="num">
                          <button type="button" className="admin-sort-btn admin-sort-btn--num" data-table="records" data-key="amount">
                            Amount <span className="sort-arrow" data-arrow-for="records:amount">↕</span>
                          </button>
                        </th>
                        <th className="actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="recordsTbody">
                      <tr><td colSpan="6" className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
      
              <section className="card admin-panel" id="receiptsPanel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Receipts</h2>
                    <p className="subtle">Receipts uploaded by the selected user.</p>
                  </div>
                </div>
                <p id="receiptsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date Added</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody id="receiptsTbody">
                      <tr><td colSpan="4" className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
      
              <section className="card admin-panel" id="budgetsPanel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Budgets</h2>
                    <p className="subtle">Budget sheets for the selected user.</p>
                  </div>
                </div>
                <p id="budgetsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Cadence</th>
                        <th>Period</th>
                        <th>Created</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody id="budgetsTbody">
                      <tr><td colSpan="4" className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
              </div>
            </section>
      
            <section className="card admin-panel" id="settingsPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button
                    className="admin-caret-toggle"
                    id="toggleSettingsPanelCaret"
                    type="button"
                    aria-expanded="true"
                    aria-controls="settingsPanelBody"
                    aria-label="Collapse App Settings section"
                  >
                    v
                  </button>
                  <div>
                    <h2>App Settings</h2>
                    <p className="subtle">Update global configuration like app name.</p>
                  </div>
                </div>
              </div>
              <div id="settingsPanelBody">
                <form id="settingsForm" className="admin-form">
                  <h3 className="admin-settings-subtitle">General</h3>
                  <label className="settings-item">
                    <span>App Name</span>
                    <input id="appNameInput" type="text" placeholder="&lt;AppName&gt;" />
                  </label>
                  <label className="settings-item">
                    <span>Receipt Storage</span>
                    <div className="checkbox-row">
                      <input id="receiptKeepFilesInput" type="checkbox" />
                      <span>
                        Keep receipt files in storage.
                        <span className="subtle">Disabling will block new uploads and delete files after parsing.</span>
                      </span>
                    </div>
                  </label>
                  <label className="settings-item">
                    <span>Session Timeout (minutes)</span>
                    <input id="sessionTimeoutMinutesInput" type="number" min="1" max="60" step="1" value="15" />
                  </label>
                  <label className="settings-item">
                    <span>Max Concurrent Sessions Per User</span>
                    <input
                      id="maxConcurrentSessionsInput"
                      type="number"
                      min="0"
                      max="1000"
                      step="1"
                      value="0"
                    />
                    <span className="subtle">Use 0 for infinite sessions.</span>
                  </label>
                  <label className="settings-item">
                    <span>Require 2FA For Admin Roles</span>
                    <div className="checkbox-row">
                      <input id="require2faForAdminRolesInput" type="checkbox" />
                      <span><span className="subtle">When enabled, admin/org-admin/support/analyst roles must have 2FA enabled to log in.</span></span>
                    </div>
                  </label>
      
                  <h3 className="admin-settings-subtitle">Notifications</h3>
                  <div className="admin-settings-inline-grid">
                    <label className="settings-item">
                      <span>Weekly Digest Day</span>
                      <select id="weeklyDigestDayInput">
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                    </label>
                    <label className="settings-item">
                      <span>Weekly Digest Time (24h)</span>
                      <input id="weeklyDigestTimeInput" type="time" value="09:00" />
                    </label>
                    <label className="settings-item">
                      <span>Weekly Digest Timezone</span>
                      <select id="weeklyDigestTimezoneInput"></select>
                    </label>
                  </div>
                  <label className="settings-item">
                    <span>Pause Non-Security Emails</span>
                    <div className="checkbox-row">
                      <input id="pauseNonSecurityEmailsInput" type="checkbox" />
                      <span><span className="subtle">Security emails can still be sent.</span></span>
                    </div>
                  </label>
                  <label className="settings-item">
                    <span>Pause All Notifications</span>
                    <div className="checkbox-row">
                      <input id="pauseAllNotificationsInput" type="checkbox" />
                      <span><span className="subtle">Disables notification delivery and in-app notification feed.</span></span>
                    </div>
                  </label>
      
                  <h3 className="admin-settings-subtitle">Uploads and OCR</h3>
                  <label className="settings-item">
                    <span>Max Upload Size (MB)</span>
                    <input id="maxUploadSizeMbInput" type="number" min="1" max="250" step="1" value="50" />
                  </label>
                  <label className="settings-item">
                    <span>OCR Timeout (seconds)</span>
                    <input id="ocrTimeoutSecondsInput" type="number" min="5" max="300" step="1" value="25" />
                  </label>
                  <label className="settings-item">
                    <span>OCR Retry Limit</span>
                    <input id="ocrRetryLimitInput" type="number" min="0" max="5" step="1" value="1" />
                  </label>
      
                  <h3 className="admin-settings-subtitle">Data and Privacy</h3>
                  <label className="settings-item">
                    <span>Default Data Export Format</span>
                    <div className="checkbox-row">
                      <input id="defaultDataExportFormatInput" type="checkbox" />
                      <span><span className="subtle">Use JSON export by default (unchecked = CSV).</span></span>
                    </div>
                  </label>
      
                  <h3 className="admin-settings-subtitle">System Operations</h3>
                  <div className="admin-maintenance-panel">
                    <label className="settings-item admin-maintenance-toggle">
                      <span>Maintenance Mode</span>
                      <div className="checkbox-row">
                        <input id="maintenanceModeEnabledInput" type="checkbox" />
                        <span><span className="subtle">Show the selected banner across its assigned pages.</span></span>
                      </div>
                    </label>
                    <div className="settings-item admin-maintenance-picker">
                      <div className="settings-item-head">
                        <span>Maintenance Message</span>
                        <p className="subtle">Choose the active saved message or add a targeted one.</p>
                      </div>
                      <div className="admin-maintenance-select-row">
                        <select id="maintenanceMessageSelect"></select>
                        <button className="btn" id="maintenanceMessageNewBtn" type="button">+ Add New</button>
                      </div>
                      <div className="admin-maintenance-preview">
                        <p id="maintenanceSelectedText" className="admin-maintenance-message-text subtle">No message selected.</p>
                        <details className="admin-checklist-dropdown" id="maintenanceSelectedPagesDropdown">
                          <summary>
                            <span id="maintenancePagesSummary">All pages selected</span>
                          </summary>
                          <div className="admin-checklist-dropdown-menu">
                            <div className="admin-checklist-grid" id="maintenanceSelectedPagesList"></div>
                          </div>
                        </details>
                      </div>
                      <div className="admin-actions admin-maintenance-actions">
                        <button className="btn" id="maintenanceMessageEditBtn" type="button">Edit</button>
                        <button className="btn" id="maintenanceMessageDefaultBtn" type="button">Make Default</button>
                        <button className="btn btn--danger" id="maintenanceMessageDeleteBtn" type="button">Delete</button>
                      </div>
                    </div>
                    <p id="maintenanceMessageStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                  </div>
      
                  <div className="admin-actions">
                    <button className="btn btn--primary" type="submit">Save Settings</button>
                  </div>
                  <div className="admin-actions">
                    <button className="btn btn--danger" id="forceLogoutAllSessionsBtn" type="button">
                      Force Logout All Users
                    </button>
                  </div>
                  <p id="settingsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                </form>
              </div>
            </section>
      
            <section className="card admin-panel" id="achievementsPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button
                    className="admin-caret-toggle"
                    id="toggleAchievementsPanelCaret"
                    type="button"
                    aria-expanded="true"
                    aria-controls="achievementsPanelBody"
                    aria-label="Collapse Achievements section"
                  >
                    v
                  </button>
                  <div>
                    <h2>Achievements Catalog</h2>
                    <p className="subtle">Add and remove achievement rules used across all users.</p>
                  </div>
                </div>
              </div>
              <div id="achievementsPanelBody">
                <div className="admin-achievements">
                  <div className="admin-achievement-builder">
                    <label id="achievementKeyWrap">
                      <span>Key</span>
                      <input id="achievementKeyInput" type="text" placeholder="expense_tracker_25" />
                      <small id="achievementKeyStatus" className="admin-field-hint is-hidden" aria-live="polite"></small>
                    </label>
                    <label>
                      <span>Title</span>
                      <input id="achievementTitleInput" type="text" placeholder="Expense Tracker Pro" />
                    </label>
                    <label>
                      <span>Description</span>
                      <input id="achievementDescriptionInput" type="text" placeholder="Add 25 expense records." />
                    </label>
                    <label id="achievementIconWrap">
                      <span>Icon</span>
                      <input id="achievementIconInput" type="text" maxLength="2" placeholder="💸" />
                    </label>
                    <label>
                      <span>Metric</span>
                      <select id="achievementMetricInput">
                        <option value="records_total">records_total</option>
                        <option value="records_income">records_income</option>
                        <option value="records_expense">records_expense</option>
                        <option value="receipts_total">receipts_total</option>
                        <option value="budgets_total">budgets_total</option>
                        <option value="net_worth_items">net_worth_items</option>
                        <option value="account_age_years">account_age_years</option>
                        <option value="two_fa_enabled">two_fa_enabled</option>
                        <option value="google_signin_enabled">google_signin_enabled</option>
                        <option value="avatar_selected">avatar_selected</option>
                      </select>
                    </label>
                    <label id="achievementTargetNumberWrap">
                      <span>Target</span>
                      <input id="achievementTargetInput" type="number" min="0.01" step="0.01" value="1" />
                    </label>
                    <label id="achievementTargetBooleanWrap" className="is-hidden">
                      <span>Target</span>
                      <select id="achievementTargetBooleanInput">
                        <option value="true">true</option>
                      </select>
                    </label>
                    <div className="admin-add-achievement-wrap">
                      <span className="admin-add-achievement-spacer" aria-hidden="true">Action</span>
                      <button className="btn btn--primary" id="addAchievementBtn" type="button">Add</button>
                    </div>
                  </div>
                </div>
                <div id="adminAchievementsList" className="admin-achievements-list"></div>
                <p id="achievementStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            <section className="card admin-panel is-collapsed" id="notificationsPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button
                    className="admin-caret-toggle"
                    id="toggleNotificationsPanelCaret"
                    type="button"
                    aria-expanded="false"
                    aria-controls="notificationsPanelBody"
                    aria-label="Expand Notifications section"
                  >
                    &gt;
                  </button>
                  <div>
                    <h2>Notifications</h2>
                    <p className="subtle">Create rich-text notifications shown to users at the top bar until dismissed.</p>
                  </div>
                </div>
              </div>
              <div id="notificationsPanelBody">
                <div className="admin-notification-editor card">
                  <div className="admin-notification-toolbar" role="toolbar" aria-label="Notification formatting controls">
                    <button className="btn btn--link" type="button" data-notification-cmd="bold"><strong>B</strong></button>
                    <button className="btn btn--link" type="button" data-notification-cmd="italic"><em>I</em></button>
                    <button className="btn btn--link" type="button" data-notification-cmd="underline"><u>U</u></button>
                    <button className="btn btn--link" type="button" data-notification-cmd="insertUnorderedList">• List</button>
                    <button className="btn btn--link" type="button" data-notification-cmd="insertOrderedList">1. List</button>
                    <button className="btn btn--link" type="button" data-notification-cmd="createLink">Link</button>
                    <button className="btn btn--link" type="button" data-notification-cmd="removeFormat">Clear</button>
                    <label className="admin-notification-toolbar-type">
                      <span>Type</span>
                      <select id="notificationTypeInput">
                        <option value="general">general</option>
                        <option value="updates">updates</option>
                        <option value="security">security</option>
                      </select>
                    </label>
                    <label className="admin-notification-toolbar-type">
                      <span>Audience</span>
                      <select id="notificationAudienceInput">
                        <option value="all">all users</option>
                        <option value="organization">organization only</option>
                      </select>
                    </label>
                    <label className="admin-notification-toolbar-type is-hidden" id="notificationOrganizationWrap" hidden>
                      <span>Organization ID</span>
                      <input id="notificationOrganizationIdInput" type="text" placeholder="organization-id" />
                    </label>
                  </div>
                  <div
                    id="notificationEditor"
                    className="admin-notification-input"
                    contentEditable="true"
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="Write notification text here..."
                  ></div>
                  <div className="admin-actions">
                    <button className="btn btn--primary" id="publishNotificationBtn" type="button">Publish Notification</button>
                  </div>
                  <p id="notificationAdminStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                </div>
      
                <div className="admin-actions">
                  <label>
                    <span>History Filter</span>
                    <select id="notificationFilterType">
                      <option value="">all</option>
                      <option value="general">general</option>
                      <option value="updates">updates</option>
                      <option value="security">security</option>
                    </select>
                  </label>
                  <label>
                    <span>Active</span>
                    <select id="notificationFilterActive">
                      <option value="">all</option>
                      <option value="true">active</option>
                      <option value="false">inactive</option>
                    </select>
                  </label>
                  <button className="btn" id="notificationFilterApplyBtn" type="button">Apply</button>
                </div>
      
                <section className="admin-notification-history-wrap">
                  <h3>Notification History</h3>
                  <div id="notificationHistoryList" className="admin-notification-history">
                    <p className="subtle">Loading notifications…</p>
                  </div>
                </section>
              </div>
            </section>
      
            <section className="card admin-panel is-collapsed" id="auditPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button className="admin-caret-toggle" id="toggleAuditPanelCaret" type="button" aria-expanded="false" aria-controls="auditPanelBody" aria-label="Expand Audit Log section">&gt;</button>
                  <div>
                    <h2>Audit Log</h2>
                    <p className="subtle">Track administrative actions and critical system updates.</p>
                  </div>
                </div>
                <div className="admin-actions">
                  <select id="auditScopeInput">
                    <option value="all">all activity</option>
                    <option value="admins">admin actions</option>
                    <option value="users">user actions</option>
                  </select>
                  <input id="auditQueryInput" type="text" placeholder="Search action, user, or email" />
                  <button className="btn" id="auditRefreshBtn" type="button">Refresh</button>
                </div>
              </div>
              <div id="auditPanelBody">
                <div className="table-wrap audit-log-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Entity</th>
                      </tr>
                    </thead>
                    <tbody id="auditTbody">
                      <tr><td colSpan="4" className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
                <p id="auditStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            <section className="card admin-panel is-collapsed" id="supportPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button className="admin-caret-toggle" id="toggleSupportPanelCaret" type="button" aria-expanded="false" aria-controls="supportPanelBody" aria-label="Expand Support Inbox section">&gt;</button>
                  <div>
                    <h2>Support Inbox</h2>
                    <p className="subtle">Review incoming support tickets and update status.</p>
                  </div>
                </div>
                <div className="admin-actions">
                  <select id="supportStatusFilter">
                    <option value="">all statuses</option>
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                  <button className="btn" id="supportRefreshBtn" type="button">Refresh</button>
                </div>
              </div>
              <div id="supportPanelBody">
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>From</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="supportTbody">
                      <tr><td colSpan="5" className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
                <p id="supportStatusMsg" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            <section className="card admin-panel is-collapsed" id="systemHealthPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button className="admin-caret-toggle" id="toggleSystemHealthPanelCaret" type="button" aria-expanded="false" aria-controls="systemHealthPanelBody" aria-label="Expand System Health section">&gt;</button>
                  <div>
                    <h2>System Health</h2>
                    <p className="subtle">APIs, services, and connections with live test and emergency disconnect actions.</p>
                  </div>
                </div>
                <div className="admin-actions">
                  <button className="btn" id="healthRefreshBtn" type="button">Refresh</button>
                </div>
              </div>
              <div id="systemHealthPanelBody">
                <div className="table-wrap admin-health-list-wrap">
                  <table className="admin-table admin-health-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>State</th>
                        <th>Details</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="healthSummary">
                      <tr><td colSpan="5" className="subtle">Loading system health…</td></tr>
                    </tbody>
                  </table>
                </div>
                <p id="healthStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
              </div>
            </section>
      
            <section className="card admin-panel is-collapsed" id="permissionsPanel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">
                  <button className="admin-caret-toggle" id="togglePermissionsPanelCaret" type="button" aria-expanded="false" aria-controls="permissionsPanelBody" aria-label="Expand Permissions section">&gt;</button>
                  <div>
                    <h2>Permissions</h2>
                    <p className="subtle">Role access matrix for admin capabilities.</p>
                  </div>
                </div>
              </div>
              <div id="permissionsPanelBody">
                <div className="table-wrap admin-permissions-wrap">
                  <table className="admin-table admin-permissions-table">
                    <thead>
                      <tr id="permissionsHeadRow">
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody id="permissionsTbody">
                      <tr><td className="subtle">Loading…</td></tr>
                    </tbody>
                  </table>
                </div>
                <p id="permissionsStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
                <p className="subtle admin-permissions-note">Only full admins can view this section.</p>
              </div>
            </section>
          </section>
        </main>
      
        <div id="footer"></div>
      
        <div id="adminUserModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminUserTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header">
              <h3 id="adminUserTitle">Edit User</h3>
              <button className="modal-close" type="button" data-close-modal>&times;</button>
            </div>
            <form id="adminUserForm" className="admin-form">
              <input type="hidden" id="adminUserId" />
              <label>
                <span>Full Name</span>
                <input id="adminUserFullName" type="text" />
              </label>
              <label>
                <span>Email</span>
                <input id="adminUserEmail" type="email" />
              </label>
              <label>
                <span>Username</span>
                <input id="adminUserUsername" type="text" />
              </label>
              <label>
                <span>
                  Role
                  <span className="info-popover">
                    <button
                      type="button"
                      className="info-popover__trigger"
                      aria-label="Org admin role scope"
                    >
                      i
                    </button>
                    <span className="info-popover__panel" role="tooltip">
                      <strong>org_admin</strong> users can only control members in their own organization. They cannot manage users from any other organization.
                    </span>
                  </span>
                </span>
                <select id="adminUserRole">
                  <option value="user">user</option>
                  <option value="org_user">org_user</option>
                  <option value="admin">admin</option>
                  <option value="org_admin">org_admin</option>
                  <option value="support_admin">support_admin</option>
                  <option value="analyst">analyst</option>
                </select>
              </label>
              <label>
                <span>Organization ID</span>
                <input id="adminUserOrganizationId" type="text" />
              </label>
              <label>
                <span>Trial Started</span>
                <input id="adminUserTrialStartedAt" type="text" readOnly />
              </label>
              <label>
                <span>Account Status</span>
                <input id="adminUserAccountStatus" type="text" readOnly />
              </label>
              <label>
                <span>Access Expires At</span>
                <input id="adminUserAccessExpiresAt" type="datetime-local" />
              </label>
              <div className="admin-actions">
                <button className="btn btn--primary" type="submit">Save User</button>
                <button className="btn btn--link" type="button" data-close-modal>Cancel</button>
              </div>
              <p id="adminUserStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </form>
          </div>
        </div>
      
        <div id="adminRecordModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminRecordTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header">
              <h3 id="adminRecordTitle">Edit Record</h3>
              <button className="modal-close" type="button" data-close-modal>&times;</button>
            </div>
            <form id="adminRecordForm" className="admin-form">
              <input type="hidden" id="adminRecordId" />
              <label>
                <span>Date</span>
                <input id="adminRecordDate" type="date" />
              </label>
              <label>
                <span>Type</span>
                <select id="adminRecordType">
                  <option value="expense">expense</option>
                  <option value="income">income</option>
                </select>
              </label>
              <label>
                <span>Category</span>
                <input id="adminRecordCategory" type="text" />
              </label>
              <label>
                <span>Amount</span>
                <input id="adminRecordAmount" type="number" min="0" step="0.01" inputMode="decimal" />
              </label>
              <label>
                <span>Note</span>
                <textarea id="adminRecordNote" rows="3"></textarea>
              </label>
              <div className="admin-actions">
                <button className="btn btn--primary" type="submit">Save Record</button>
                <button className="btn btn--link" type="button" data-close-modal>Cancel</button>
              </div>
              <p id="adminRecordStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </form>
          </div>
        </div>

        <div id="inviteMemberModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="inviteMemberTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header"><h3 id="inviteMemberTitle">Invite Organization Member</h3><button className="modal-close" type="button" data-close-modal>&times;</button></div>
            <form id="inviteMemberForm" className="admin-form">
              <p className="subtle">The recipient will receive a seven-day link to create an organization member account.</p>
              <label><span>Email address</span><input id="inviteMemberEmail" type="email" autoComplete="email" required /></label>
              <div className="admin-actions"><button className="btn btn--primary" type="submit">Send Invitation</button><button className="btn btn--link" type="button" data-close-modal>Cancel</button></div>
              <p id="inviteMemberStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </form>
          </div>
        </div>

        <div id="maintenanceMessageModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="maintenanceMessageModalTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header">
              <h3 id="maintenanceMessageModalTitle">Maintenance Message</h3>
              <button className="modal-close" type="button" data-close-modal>&times;</button>
            </div>
            <form id="maintenanceMessageForm" className="admin-form">
              <label>
                <span>Name</span>
                <input id="maintenanceMessageTitleInput" type="text" maxLength="80" placeholder="Privacy policy update" />
              </label>
              <label>
                <span>Banner Text</span>
                <input id="maintenanceModeBannerTextInput" type="text" maxLength="500" placeholder="Please be aware: Maintenance is underway." />
              </label>
              <div className="settings-item-head">
                <span>Pages</span>
                <p className="subtle">Select where this message should appear.</p>
              </div>
              <div className="admin-checklist-actions">
                <button className="btn btn--link" id="maintenancePagesSelectAllBtn" type="button">Select All</button>
                <button className="btn btn--link" id="maintenancePagesClearBtn" type="button">Clear</button>
              </div>
              <div className="admin-checklist-grid admin-checklist-grid--modal" id="maintenancePagesChecklist">
                {MAINTENANCE_PAGE_OPTIONS.map(([value, label]) => (
                  <label className="checkbox-row" key={value}>
                    <input type="checkbox" data-maintenance-page-id={value} defaultChecked />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="admin-actions">
                <button className="btn btn--primary" id="maintenanceMessageSaveBtn" type="submit">Save Message</button>
                <button className="btn btn--link" type="button" data-close-modal>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      
        <div id="adminPermissionModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminPermissionTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header">
              <h3 id="adminPermissionTitle">Permission Required</h3>
              <button className="modal-close" type="button" data-close-modal>&times;</button>
            </div>
            <p id="adminPermissionMessage" className="subtle">
              You must be admin type or higher to edit.
            </p>
            <div className="admin-actions">
              <button className="btn btn--primary" type="button" data-close-modal>OK</button>
            </div>
          </div>
        </div>
      
        <div id="adminHealthDisconnectModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminHealthDisconnectTitle">
          <div className="modal-content admin-modal">
            <div className="modal-header">
              <h3 id="adminHealthDisconnectTitle">Disconnect Service</h3>
              <button className="modal-close" type="button" data-close-modal>&times;</button>
            </div>
            <p id="adminHealthDisconnectMessage" className="subtle">
              Are you sure? Enter your password and press Disconnect.
            </p>
            <form id="adminHealthDisconnectForm" className="admin-form">
              <label>
                <span id="adminHealthDisconnectCredentialLabel">Password</span>
                <input id="adminHealthDisconnectPassword" type="password" autoComplete="current-password" required />
              </label>
              <div className="admin-actions">
                <button className="btn btn--primary" id="adminHealthDisconnectBtn" type="submit">Disconnect</button>
                <button className="btn btn--link" type="button" data-close-modal>Cancel</button>
              </div>
              <p id="adminHealthDisconnectStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </form>
          </div>
        </div>
    </>
  );
}
