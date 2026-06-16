export default function ProfilePage() {
  return (
    <>
      <div id="header"></div>
      
      
        <main className="main main--profile">
      
          {/* HERO */}
          <section className="profile-hero">
            <div className="title-wrap">
              <h1>Profile</h1>
              <p className="subtle">View and update your personal info</p>
            </div>
            <div className="actions" role="group">
              <p id="profileStatus" className="status-banner subtle is-hidden profile-status-inline" aria-live="polite"></p>
              <button id="editProfileBtn" className="btn btn--primary" type="button">
                Edit Profile
              </button>
              <button id="cancelEditBtn" className="btn is-hidden" type="button">
                Cancel
              </button>
              <button id="saveProfileBtn" className="btn btn--primary is-hidden" type="submit" form="editForm">
                Save Changes
              </button>
            </div>
          </section>
      
          <div className="profile-grid">
      
            {/* SUMMARY + EDIT FORM */}
            <section className="card profile-card">
              <div className="avatar-block">
                <div className="avatar"></div>
                <div className="identity">
                  <h3 className="name" id="fullName">&mdash;</h3>
                  <p className="subtle" id="username">@&mdash;</p>
                </div>
                <div className="avatar-actions">
                  <button className="btn is-hidden" id="changeAvatarBtnTop" data-avatar-trigger type="button">Change Avatar</button>
                </div>
              </div>
      
              <dl id="profileSummary" className="meta">
                <div><dt>Email</dt><dd id="email">&mdash;</dd></div>
                <div><dt>Phone</dt><dd id="phoneNumber">&mdash;</dd></div>
                <div><dt>Location</dt><dd id="location">&mdash;</dd></div>
                <div><dt>Role</dt><dd id="role">&mdash;</dd></div>
                <div><dt>Member Since</dt><dd id="createdAt">&mdash;</dd></div>
                <div><dt>Bio</dt><dd id="bio">&mdash;</dd></div>
              </dl>
      
              {/* EDIT FORM */}
              <form id="editForm" className="edit-form" hidden>
                <div className="edit-form-header">
                  <h3>Edit Profile</h3>
                  <p className="subtle">Update your contact details and profile info.</p>
                </div>
                <div className="form-grid">
                  <label><span className="label">Full Name</span><input id="input_fullName" name="fullName" type="text" autoComplete="name" required /></label>
                  <label><span className="label">Username</span><input id="input_username" name="username" type="text" autoComplete="username" required /></label>
                  <label><span className="label">Email</span><input id="input_email" name="email" type="email" autoComplete="email" required /></label>
                  <label><span className="label">Phone Number</span><input id="input_phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" /></label>
                  <label><span className="label">Location</span><input id="input_location" name="location" type="text" autoComplete="address-level2" /></label>
                  <label className="span-2"><span className="label">Bio</span><textarea id="input_bio" name="bio" rows="4" autoComplete="off"></textarea></label>
                </div>
      
                <div className="form-actions">
                  <button type="button" id="changeAvatarBtnForm" data-avatar-trigger className="btn">Change Avatar</button>
                </div>
              </form>
      
              <div className="actions">
                <input id="avatarInput" type="file" accept="image/*" hidden />
              </div>
            </section>
      
            {/* AVATAR MODAL */}
            <div id="avatarModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="avatarModalTitle">
              <div className="modal-backdrop" data-close="avatar"></div>
              <div className="modal-content card avatar-modal-content">
                <div className="avatar-modal-header">
                  <h2 id="avatarModalTitle">Choose an Avatar</h2>
                  <button className="btn btn--link avatar-modal-close" id="closeAvatarModal" type="button" aria-label="Close avatar picker">Close</button>
                </div>
                <p className="subtle">Pick one of the preset avatars below.</p>
                <div id="avatarChoices" className="avatar-grid" role="listbox" aria-label="Avatar choices"></div>
                <div className="modal-actions">
                  <button className="btn" id="cancelAvatarBtn" type="button">Cancel</button>
                  <button className="btn btn--primary" id="saveAvatarBtn" type="button">Use Selected</button>
                </div>
              </div>
            </div>
            {/* IDENTITY + STATS */}
            <section className="card security">
              <div className="security-header">
                <h2>Identity & Stats</h2>
              </div>
      
              <div id="identityDisplay" className="security-rows">
                <div className="security-row">
                  <div className="sr-left"><p className="label">Address</p></div>
                  <div className="sr-right align-right" id="identityAddress">&mdash;</div>
                </div>
      
                <div className="security-row">
                  <div className="sr-left"><p className="label">Employer</p></div>
                  <div className="sr-right align-right" id="identityEmployer">&mdash;</div>
                </div>
      
                <div className="security-row">
                  <div className="sr-left"><p className="label">Income Range</p></div>
                  <div className="sr-right align-right" id="identityIncome">&mdash;</div>
                </div>
              </div>
      
              <form id="identityForm" className="edit-form edit-form--identity" hidden>
                <div className="form-grid">
                  <label><span className="label">Address</span><input id="input_identityAddress" name="identityAddress" type="text" autoComplete="street-address" /></label>
                  <label><span className="label">Employer</span><input id="input_identityEmployer" name="identityEmployer" type="text" autoComplete="organization" /></label>
                  <label>
                    <span className="label">Income Range</span>
                    <select id="input_identityIncome" name="identityIncome">
                      <option value="" disabled selected>Select income range</option>
                      <option value="Under $25k">Under $25k</option>
                      <option value="$25k–$50k">$25k–$50k</option>
                      <option value="$50k–$75k">$50k–$75k</option>
                      <option value="$75k–$100k">$75k–$100k</option>
                      <option value="$100k+">$100k+</option>
                    </select>
                  </label>
                </div>
              </form>
      
              <div className="security-rows stats-rows">
                <div className="security-row">
                  <div className="sr-left"><p className="label">Last Login</p></div>
                  <div className="sr-right align-right" id="stat_lastLogin">&mdash;</div>
                </div>
      
                <div className="security-row">
                  <div className="sr-left"><p className="label">Records Uploaded</p></div>
                  <div className="sr-right align-right" id="stat_uploads">&mdash;</div>
                </div>
              </div>
            </section>
      
            {/* LINKED ACCOUNTS */}
            <section className="card linked-accounts">
              <div className="section-head">
                <div>
                  <div className="section-headline stack">
                    <h2>Linked Accounts</h2>
                  </div>
                  <p className="testing-banner" role="status">In Testing Phase - Coming Soon</p>
                  <p className="subtle">Connect Plaid sandbox accounts to sync balances and transactions into Records.</p>
                </div>
                <button className="btn btn--primary" id="linkAccountBtn" type="button">Connect Account</button>
                <button className="btn" id="syncAccountsBtn" type="button">Sync Transactions</button>
              </div>
      
              <div id="linkedAccountsList" className="linked-list linked-list--scroll">
                <div className="linked-item">
                  <div>
                    <p className="label">No accounts linked yet</p>
                    <p className="subtle">Connect a Plaid sandbox institution to start importing transactions.</p>
                  </div>
                </div>
              </div>
            </section>
      
            {/* UNLINK ACCOUNT MODAL */}
            <div id="unlinkAccountModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="unlinkAccountTitle">
              <div className="modal-backdrop" data-close="unlink-account"></div>
              <div className="modal-content card">
                <div className="modal-header">
                  <h2 id="unlinkAccountTitle">Remove Linked Account</h2>
                  <button className="btn btn--link" id="closeUnlinkAccountModal" type="button">Close</button>
                </div>
                <p className="subtle" id="unlinkAccountText">Do you want to export this account's history before unlinking it?</p>
      
                <p className="subtle">Unlinking removes imported transactions and linked balance data for this account from the app.</p>
      
                <div className="modal-actions">
                  <button className="btn" id="cancelUnlinkAccount" type="button">Cancel</button>
                  <button className="btn" id="unlinkWithoutExportBtn" type="button">Unlink Without Export</button>
                  <button className="btn btn--primary" id="exportAndUnlinkBtn" type="button">Export and Unlink</button>
                </div>
              </div>
            </div>
      
            {/* ACHIEVEMENTS */}
            <section className="card achievements">
              <div className="section-headline inline">
                <h2>Achievements</h2>
              </div>
              <p id="achievementStatus" className="subtle">Loading achievements...</p>
              <div className="achievement-grid achievement-grid--scroll" id="achievementGrid">
              </div>
            </section>
      
            {/* ACTIVITY */}
            <section className="card activity">
              <h2>Recent Activity</h2>
              <div className="table-wrap">
                <table className="txn-table activity-table">
                  <thead>
                    <tr>
                      <th className="date-col"><span className="activity-date">Date</span></th>
                      <th className="activity-col">Activity</th>
                      <th className="ip-col">IP</th>
                      <th className="result-col">Result</th>
                    </tr>
                  </thead>
                  <tbody id="activityBody">
                    <tr><td colSpan="4" className="subtle">No activity yet</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
      
          </div>
        </main>
      
        <div id="footer"></div>
    </>
  );
}
