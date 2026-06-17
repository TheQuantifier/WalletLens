import { useEffect } from "react";
import { initUploadPage } from "../pageControllers/uploadPageController.js";

export default function UploadPage() {
  useEffect(() => {
    initUploadPage();
    return () => {
      window.__walletlensUploadPageInitialized = false;
    };
  }, []);

  return (
    <>
      {/* Header injected by default.js */}
        <div id="header"></div>
      
      
        <main className="main main--upload">
          <section className="upload-hero">
            <h1>Upload Receipts</h1>
            <p className="subtle">Drop PDFs or images to scan receipts. You can choose to save files or scan-only.</p>
          </section>
      
          <section className="uploader card">
            <label htmlFor="fileInput" className="file-label">Choose files</label>
      
            <div id="dropzone" className="dropzone" role="button" tabIndex="0" aria-label="Upload dropzone">
              <div className="dz-inner">
                <svg className="dz-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6M7 10l5-6 5 6M12 4v12"
                    fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
      
                <div className="dz-text">
                  <strong>Click to select</strong>
                  or drag & drop files here
                </div>
              </div>
      
              <input id="fileInput" className="dz-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,.tif,.tiff,.bmp,.webp" multiple />
            </div>
      
            <ul className="tips">
              <li>Accepted: PDF, PNG, JPG, HEIC/HEIF, TIFF, BMP, WEBP (up to 50MB)</li>
              <li>Scan-only skips file storage; Save stores the file for later download.</li>
            </ul>
      
            <div className="file-list-wrap">
              <div className="file-list-title">Pending files</div>
              <div id="fileList" className="file-list"></div>
            </div>
      
            <div className="actions">
              <button id="clearBtn" className="btn" type="button">Clear</button>
              <button id="uploadBtn" className="btn btn--primary" type="button" disabled>Upload</button>
            </div>
      
            <p id="statusMsg" className="status-banner subtle is-hidden" role="status" aria-live="polite"></p>
          </section>
      
          <section className="recent card">
            <h2>Recent uploads</h2>
      
            <div className="table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th scope="col">File name</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">Size</th>
                    <th scope="col">Uploaded</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="actions-col">Actions</th>
                  </tr>
                </thead>
      
                <tbody id="recentTableBody">
                  <tr><td colSpan="6" className="subtle">Loading…</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      
        {/* Footer injected by default.js */}
        <div id="footer"></div>
        
      
      
        {/* ===================== DELETE RECEIPT MODAL ===================== */}
        <div id="deleteModal" className="modal hidden">
          <div className="modal-backdrop"></div>
      
          <div className="modal-content">
            <h3>Delete Receipt</h3>
            <p>This receipt may be linked to a financial record. What would you like to delete?</p>
      
            <div className="modal-actions">
              <button id="btnDeleteFile" className="btn btn--danger" type="button">Delete Receipt Only</button>
              <button id="btnDeleteBoth" className="btn btn--warning" type="button">Delete Both Receipt & Record</button>
              <button id="btnDeleteCancel" className="btn" type="button">Cancel</button>
            </div>
          </div>
        </div>
      
        {/* ===================== UPLOAD MODE MODAL ===================== */}
        <div id="uploadModeModal" className="modal hidden">
          <div className="modal-backdrop"></div>
      
          <div className="modal-content">
            <h3>Upload Options</h3>
            <p>Would you like to save the file, or just scan it without storing?</p>
      
            <div className="modal-actions">
              <button id="btnScanOnly" className="btn btn--warning" type="button">Scan Only</button>
              <button id="btnSaveAndScan" className="btn btn--primary" type="button">Save & Scan</button>
              <button id="btnUploadCancel" className="btn" type="button">Cancel</button>
            </div>
          </div>
        </div>
      
        {/* ===================== OCR REVIEW MODAL ===================== */}
        <div id="ocrReviewModal" className="modal hidden">
          <div className="modal-backdrop"></div>
      
          <div className="modal-content">
            <h3>Parsed Text Review</h3>
            <p>
              This is the parsed text from your receipt. Please make sure it is correct.
              If not, edit it below to correct it.
            </p>
      
            <textarea id="ocrReviewText" rows="12" style={{ "width": "100%" }} spellCheck="false"></textarea>
      
            <div className="modal-actions">
              <button id="btnOcrReviewDone" className="btn btn--primary" type="button">Done</button>
            </div>
          </div>
        </div>
      
        {/* Scripts */}
    </>
  );
}
