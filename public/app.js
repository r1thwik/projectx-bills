// Project Bills Labs — Frontend Logic
const App = {
    state: { currentStage: 'upload', file: null, extractedData: null, lookupData: null, filePath: null, fileName: null, lineItems: [] },

    els: {},

    init() {
        // Cache all DOM refs
        const q = (s) => document.querySelector(s);
        this.els = {
            dropzone: q('#dropzone'), fileInput: q('#file-input'), filePreview: q('#file-preview'),
            previewThumb: q('#preview-thumb'), previewName: q('#preview-name'),
            removeFileBtn: q('#remove-file-btn'), extractBtn: q('#extract-btn'),
            progressFill: q('#progress-fill'),
            vendorName: q('#vendor_name'), vendorId: q('#vendor_id'), vendorGstin: q('#vendor_gstin'),
            vendorDropdown: q('#vendor-dropdown'),
            billNumber: q('#bill_number'), invoiceDate: q('#invoice_date'),
            gstType: q('#gst_type'), taxTreatment: q('#tax_treatment'), gstRate: q('#gst_rate'),
            accountId: q('#account_id'), paidThrough: q('#paid_through_account_id'),
            lineItemsBody: q('#line-items-body'), addLineItemBtn: q('#add-line-item-btn'),
            subtotal: q('#subtotal'), taxTotal: q('#tax-total'), grandTotal: q('#grand-total'),
            backBtn: q('#back-btn'), confirmBtn: q('#confirm-btn'), newBillBtn: q('#new-bill-btn'),
            successDetails: q('#success-details'),
            errorBar: q('#error-bar'), errorMsg: q('#error-msg'), errorDismiss: q('#error-dismiss'),
        };
        this.bindEvents();
        this.loadLookupData();
    },

    bindEvents() {
        const dz = this.els.dropzone;
        dz.addEventListener('click', () => this.els.fileInput.click());
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('drag-over'); if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]); });
        this.els.fileInput.addEventListener('change', (e) => { if (e.target.files[0]) this.handleFile(e.target.files[0]); });
        this.els.removeFileBtn.addEventListener('click', () => this.removeFile());
        this.els.extractBtn.addEventListener('click', () => this.extract());
        this.els.backBtn.addEventListener('click', () => this.reset());
        this.els.confirmBtn.addEventListener('click', () => this.confirmAndSubmit());
        this.els.newBillBtn.addEventListener('click', () => this.reset());
        this.els.addLineItemBtn.addEventListener('click', () => this.addLineItemRow());
        this.els.errorDismiss.addEventListener('click', () => this.hideError());
        this.els.taxTreatment.addEventListener('change', () => this.updateTotals());

        // Vendor autocomplete
        let debounce;
        this.els.vendorName.addEventListener('input', () => {
            clearTimeout(debounce);
            const q = this.els.vendorName.value.trim();
            if (q.length < 2) { this.els.vendorDropdown.classList.remove('show'); return; }
            debounce = setTimeout(() => this.searchVendors(q), 300);
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-dropdown') && e.target !== this.els.vendorName) {
                this.els.vendorDropdown.classList.remove('show');
            }
        });
    },

    handleFile(file) {
        this.state.file = file;
        this.els.dropzone.style.display = 'none';
        this.els.filePreview.style.display = 'flex';
        this.els.previewName.textContent = file.name;
        this.els.extractBtn.disabled = false;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => { this.els.previewThumb.innerHTML = `<img src="${e.target.result}">`; };
            reader.readAsDataURL(file);
        } else {
            this.els.previewThumb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
    },

    removeFile() {
        this.state.file = null;
        this.els.fileInput.value = '';
        this.els.dropzone.style.display = '';
        this.els.filePreview.style.display = 'none';
        this.els.extractBtn.disabled = true;
    },

    async extract() {
        if (!this.state.file) return;
        this.goToStage('processing');
        this.els.progressFill.style.width = '0%';

        const interval = setInterval(() => {
            const w = parseFloat(this.els.progressFill.style.width) || 0;
            if (w < 85) this.els.progressFill.style.width = (w + Math.random() * 8) + '%';
        }, 600);

        try {
            const form = new FormData();
            form.append('invoice', this.state.file);
            const res = await fetch('/api/upload', { method: 'POST', body: form });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Upload failed');

            this.els.progressFill.style.width = '100%';
            clearInterval(interval);
            this.state.extractedData = json.data;
            this.state.filePath = json.data.file_path;
            this.state.fileName = json.data.file_name;
            setTimeout(() => this.populateReview(json.data), 400);
        } catch (err) {
            clearInterval(interval);
            this.showError(err.message);
            this.goToStage('upload');
        }
    },

    populateReview(data) {
        this.els.vendorName.value = data.vendor_name || '';
        this.els.vendorId.value = '';
        this.els.vendorGstin.value = data.vendor_gstin || '';
        this.els.billNumber.value = data.invoice_number || '';
        this.els.invoiceDate.value = data.invoice_date || '';
        this.els.gstType.value = data.gst_type || 'intra_state';
        this.els.taxTreatment.value = data.tax_treatment || 'exclusive';

        // Line items
        this.els.lineItemsBody.innerHTML = '';
        const items = data.line_items || [];
        items.forEach(item => this.addLineItemRow(item));
        this.updateTotals();

        // Auto-match vendor
        if (data.vendor_name && this.state.lookupData?.vendors) {
            const nameLower = data.vendor_name.toLowerCase().trim();
            const match = this.state.lookupData.vendors.find(v =>
                v.contact_name.toLowerCase().trim() === nameLower ||
                v.contact_name.toLowerCase().includes(nameLower) ||
                nameLower.includes(v.contact_name.toLowerCase())
            );
            if (match) this.els.vendorId.value = match.contact_id;
        }

        this.goToStage('review');
    },

    addLineItemRow(item = {}) {
        const taxes = this.state.lookupData?.taxes || [];
        const tr = document.createElement('tr');
        const gstRate = parseFloat(item.gst_rate) || 0;

        // Find matching tax
        const gstType = this.els.gstType?.value || 'intra_state';
        const keywords = gstType === 'inter_state' ? ['igst'] : ['gst', 'cgst', 'sgst'];
        let matchedTaxId = '';
        let matchedTax = taxes.find(t => Math.abs(t.tax_percentage - gstRate) < 0.01 && keywords.some(k => t.tax_name.toLowerCase().includes(k)));
        if (!matchedTax) matchedTax = taxes.find(t => Math.abs(t.tax_percentage - gstRate) < 0.01);
        if (matchedTax) matchedTaxId = matchedTax.tax_id;

        const taxOptions = taxes.map(t => `<option value="${t.tax_id}" ${t.tax_id === matchedTaxId ? 'selected' : ''}>${t.tax_name} (${t.tax_percentage}%)</option>`).join('');

        tr.innerHTML = `
      <td><input type="text" class="li-desc" value="${this.esc(item.description || '')}"></td>
      <td><input type="number" class="li-amount" step="0.01" value="${(Math.round((parseFloat(item.amount) || 0) * 100) / 100)}"></td>
      <td><input type="number" class="li-gst" step="0.01" value="${gstRate}" readonly></td>
      <td><select class="li-tax"><option value="">No Tax</option>${taxOptions}</select></td>
      <td><button type="button" class="btn-remove-row">✕</button></td>`;

        // Events
        tr.querySelector('.li-amount').addEventListener('input', () => this.updateTotals());
        tr.querySelector('.li-tax').addEventListener('change', (e) => {
            const sel = taxes.find(t => t.tax_id === e.target.value);
            tr.querySelector('.li-gst').value = sel ? sel.tax_percentage : 0;
            this.updateTotals();
        });
        tr.querySelector('.btn-remove-row').addEventListener('click', () => { tr.remove(); this.updateTotals(); });

        this.els.lineItemsBody.appendChild(tr);
        this.updateGstRateDisplay();
    },

    collectLineItems() {
        return [...this.els.lineItemsBody.querySelectorAll('tr')].map(tr => ({
            description: tr.querySelector('.li-desc').value,
            amount: parseFloat(tr.querySelector('.li-amount').value) || 0,
            gst_rate: parseFloat(tr.querySelector('.li-gst').value) || 0,
            tax_id: tr.querySelector('.li-tax').value,
        }));
    },

    updateTotals() {
        const items = this.collectLineItems();
        const isInclusive = this.els.taxTreatment.value === 'inclusive';
        let subtotal = 0, taxAmt = 0;

        items.forEach(i => {
            const amt = Math.round(i.amount * 100) / 100;
            const rate = i.gst_rate / 100;
            if (isInclusive) {
                const base = Math.round((amt / (1 + rate)) * 100) / 100;
                subtotal += base;
                taxAmt += Math.round((amt - base) * 100) / 100;
            } else {
                subtotal += amt;
                taxAmt += Math.round((amt * rate) * 100) / 100;
            }
        });

        this.els.subtotal.textContent = `₹${subtotal.toFixed(2)}`;
        this.els.taxTotal.textContent = `₹${taxAmt.toFixed(2)}`;
        this.els.grandTotal.textContent = `₹${(subtotal + taxAmt).toFixed(2)}`;
        this.updateGstRateDisplay();
    },

    updateGstRateDisplay() {
        const rates = [...new Set(this.collectLineItems().map(i => i.gst_rate).filter(r => r > 0))];
        this.els.gstRate.value = rates.length ? rates.map(r => r + '%').join(', ') : 'N/A';
    },

    async confirmAndSubmit() {
        const lineItems = this.collectLineItems().filter(i => i.amount > 0);
        if (!lineItems.length) return this.showError('No valid line items.');
        if (!this.els.vendorName.value.trim()) return this.showError('Vendor name is required.');
        if (!this.els.accountId.value) return this.showError('Select an expense account.');

        this.els.confirmBtn.disabled = true;
        this.els.confirmBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;margin:0;border-width:2px"></div> Uploading…';

        try {
            const payload = {
                vendor_name: this.els.vendorName.value.trim(),
                vendor_id: this.els.vendorId.value || null,
                vendor_gstin: this.els.vendorGstin.value.trim() || null,
                bill_number: this.els.billNumber.value.trim(),
                invoice_date: this.els.invoiceDate.value,
                gst_type: this.els.gstType.value,
                tax_treatment: this.els.taxTreatment.value,
                account_id: this.els.accountId.value,
                paid_through_account_id: this.els.paidThrough.value || null,
                reverse_charge: document.querySelector('input[name="reverse_charge"]:checked')?.value === 'true',
                line_items: lineItems,
                file_path: this.state.filePath,
                file_name: this.state.fileName,
            };

            const res = await fetch('/api/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Submission failed');

            this.showSuccess(json.expense);
        } catch (err) {
            this.showError(err.message);
            this.els.confirmBtn.disabled = false;
            this.els.confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Upload to Zoho';
        }
    },

    showSuccess(expense) {
        this.els.successDetails.innerHTML = `
      <div class="detail-row"><span class="label">Expense ID</span><span class="value">${expense.expense_id}</span></div>
      <div class="detail-row"><span class="label">Reference</span><span class="value">${expense.reference_number || '—'}</span></div>
      <div class="detail-row"><span class="label">Vendor</span><span class="value">${expense.vendor_name || '—'}</span></div>
      <div class="detail-row"><span class="label">Total</span><span class="value">₹${parseFloat(expense.total || 0).toFixed(2)}</span></div>`;
        this.goToStage('success');
    },

    async loadLookupData() {
        if (this.state.lookupData) return;
        try {
            const res = await fetch('/api/lookup');
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            this.state.lookupData = json.data;
            this.populateDropdowns(json.data);
        } catch (err) {
            this.showError('Lookup failed: ' + err.message);
        }
    },

    populateDropdowns(data) {
        this.els.accountId.innerHTML = '<option value="">Select account…</option>' +
            (data.expenseAccounts || []).map(a => {
                const sel = a.account_name.toLowerCase().includes('cost of goods sold') ? 'selected' : '';
                return `<option value="${a.account_id}" ${sel}>${a.account_name}</option>`;
            }).join('');

        const ptName = 'projectx labs';
        this.els.paidThrough.innerHTML = '<option value="">Select…</option>' +
            (data.bankAccounts || []).map(a => {
                const sel = a.account_name.toLowerCase().includes(ptName) ? 'selected' : '';
                return `<option value="${a.account_id}" ${sel}>${a.account_name}</option>`;
            }).join('');
    },

    async searchVendors(query) {
        try {
            const q = query.toLowerCase();
            let vendors = [];

            // Search cached vendors first (instant, sorted by relevance)
            if (this.state.lookupData?.vendors?.length) {
                const cached = this.state.lookupData.vendors;
                const exact = [], startsWith = [], contains = [];
                for (const v of cached) {
                    const name = v.contact_name.toLowerCase();
                    if (name === q) exact.push(v);
                    else if (name.startsWith(q)) startsWith.push(v);
                    else if (name.includes(q)) contains.push(v);
                }
                vendors = [...exact, ...startsWith, ...contains];
            }

            // Fall back to API if no cached matches
            if (!vendors.length) {
                const res = await fetch(`/api/vendors/search?q=${encodeURIComponent(query)}`);
                const json = await res.json();
                vendors = json.vendors || [];
            }

            if (!vendors.length) { this.els.vendorDropdown.classList.remove('show'); return; }

            this.els.vendorDropdown.innerHTML = vendors.slice(0, 8).map(v =>
                `<div class="autocomplete-item" data-id="${v.contact_id}" data-name="${this.esc(v.contact_name)}">
          <div class="vendor-name">${this.esc(v.contact_name)}</div>
          ${v.gst_no ? `<div class="vendor-sub">${v.gst_no}</div>` : ''}
        </div>`
            ).join('');
            this.els.vendorDropdown.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', () => {
                    this.els.vendorName.value = el.dataset.name;
                    this.els.vendorId.value = el.dataset.id;
                    this.els.vendorDropdown.classList.remove('show');
                });
            });
            this.els.vendorDropdown.classList.add('show');
        } catch { }
    },

    goToStage(stage) {
        this.state.currentStage = stage;
        document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
        document.getElementById(`${stage}-stage`).classList.add('active');

        // Update indicators
        const steps = { upload: 1, processing: 1, review: 2, success: 3 };
        const current = steps[stage] || 1;
        for (let i = 1; i <= 3; i++) {
            const step = document.getElementById(`step-${i}`);
            step.classList.remove('active', 'completed');
            if (i < current) step.classList.add('completed');
            else if (i === current) step.classList.add('active');
        }
        for (let i = 1; i <= 2; i++) {
            document.getElementById(`line-${i}`).classList.toggle('active', i < current);
        }
    },

    showError(msg) {
        this.els.errorMsg.textContent = msg;
        this.els.errorBar.classList.add('show');
        clearTimeout(this._errorTimeout);
        this._errorTimeout = setTimeout(() => this.hideError(), 8000);
    },

    hideError() { this.els.errorBar.classList.remove('show'); },

    reset() {
        this.state = { currentStage: 'upload', file: null, extractedData: null, lookupData: this.state.lookupData, filePath: null, fileName: null, lineItems: [] };
        this.els.fileInput.value = '';
        this.els.dropzone.style.display = '';
        this.els.filePreview.style.display = 'none';
        this.els.extractBtn.disabled = true;
        this.els.vendorName.value = '';
        this.els.vendorId.value = '';
        this.els.vendorGstin.value = '';
        this.els.billNumber.value = '';
        this.els.invoiceDate.value = '';
        this.els.lineItemsBody.innerHTML = '';
        this.els.progressFill.style.width = '0%';
        this.els.confirmBtn.disabled = false;
        this.els.confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Upload to Zoho';
        this.hideError();
        this.goToStage('upload');
    },

    esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};

document.addEventListener('DOMContentLoaded', () => App.init());
