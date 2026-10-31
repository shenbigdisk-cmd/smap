<script lang="ts">
  import { mapStore } from '../stores/mapStore.svelte'
  import { formatArea } from '../utils/geodesy'

  let p = $derived(mapStore.selectedParcel)
  let today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  function printReport() {
    window.print()
  }
</script>

{#if mapStore.reportModalOpen && p}
  <div
    class="report-overlay"
    role="button"
    tabindex="0"
    aria-label="Close report preview"
    onclick={() => (mapStore.reportModalOpen = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape') mapStore.reportModalOpen = false
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="report-modal"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Planning Property Report"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="report-actions-bar no-print">
        <span class="report-title-label">PLANNING PROPERTY REPORT PREVIEW</span>
        <div class="bar-btns">
          <button class="print-btn" onclick={printReport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print / Save PDF</span>
          </button>
          <button class="close-report-btn" onclick={() => (mapStore.reportModalOpen = false)}>
            Close
          </button>
        </div>
      </div>

      <!-- Printable Report Document -->
      <div class="printable-document">
        <div class="doc-header">
          <div class="doc-brand">
            <span class="doc-crest">VICTORIA STATE GOVERNMENT</span>
            <h1 class="doc-main-title">PLANNING PROPERTY REPORT</h1>
            <span class="doc-subtitle">From www.planning.vic.gov.au at {today}</span>
          </div>
          <div class="doc-meta-badge">
            <span class="meta-label">REPORT REFERENCE</span>
            <span class="meta-val">VPR-{p.councilPropId}</span>
          </div>
        </div>

        <div class="doc-section">
          <h2 class="section-heading">PROPERTY DETAILS</h2>
          <table class="report-table">
            <tbody>
              <tr>
                <td class="col-lbl">Address:</td>
                <td class="col-val strong">{p.address}</td>
              </tr>
              <tr>
                <td class="col-lbl">Lot and Plan:</td>
                <td class="col-val">{p.lotPlan}</td>
              </tr>
              <tr>
                <td class="col-lbl">Standard Parcel Identifier (SPI):</td>
                <td class="col-val mono">{p.spi}</td>
              </tr>
              <tr>
                <td class="col-lbl">Local Government Area (Council):</td>
                <td class="col-val">{p.lga} (Council Prop ID: {p.councilPropId})</td>
              </tr>
              <tr>
                <td class="col-lbl">Council Ward:</td>
                <td class="col-val">{p.ward}</td>
              </tr>
              <tr>
                <td class="col-lbl">Calculated Cadastral Area:</td>
                <td class="col-val numbers">{formatArea(p.areaM2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="doc-section">
          <h2 class="section-heading">PLANNING ZONES</h2>
          <div class="planning-box">
            <div class="zone-row">
              <span class="pill-badge" style="background-color: {p.zone.fillColor}; border-color: {p.zone.strokeColor}; color: #ffffff;">
                {p.zone.code}
              </span>
              <div class="zone-details">
                <span class="zone-title">{p.zone.name}</span>
                {#if p.zone.schedule}
                  <span class="zone-sub">{p.zone.schedule}</span>
                {/if}
              </div>
            </div>
            <p class="statutory-note">
              Planning schemes are prepared by local councils and the Department of Transport and Planning. Each planning scheme sets out policies and provisions for the use, development and protection of land.
            </p>
          </div>
        </div>

        <div class="doc-section">
          <h2 class="section-heading">PLANNING OVERLAYS</h2>
          {#if p.overlays.length > 0}
            <table class="report-table border-table">
              <thead>
                <tr>
                  <th>Overlay Code</th>
                  <th>Name & Statutory Description</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {#each p.overlays as overlay}
                  <tr>
                    <td class="mono-code">{overlay.code}</td>
                    <td>{overlay.name}</td>
                    <td>{overlay.schedule || 'Standard Provision'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="no-overlays-text">No statutory planning overlays affect this property.</p>
          {/if}
        </div>

        <div class="doc-footer">
          <p class="disclaimer-text">
            Disclaimer: This report provides basic information to identify the property and statutory planning provisions under the Planning and Environment Act 1987. For legal due diligence, an official Planning Certificate should be obtained from LANDATA.
          </p>
          <div class="doc-seal">
            <span>Official VicPlan Generated Document</span>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .report-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
    overflow-y: auto;
  }

  .report-modal {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    width: 100%;
    max-width: 720px;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .report-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background-color: var(--bg-header);
    color: var(--text-on-accent);
    flex-shrink: 0;
  }

  .report-title-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .bar-btns {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .print-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .print-btn:hover {
    background-color: var(--accent-hover);
  }

  .close-report-btn {
    padding: 6px 10px;
    background: transparent;
    color: var(--text-light);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-report-btn:hover {
    background-color: var(--bg-subtle);
    color: var(--text-main);
  }

  .printable-document {
    padding: 32px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: #0f172a;
    background-color: #ffffff;
  }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 12px;
  }

  .doc-crest {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #0284c7;
  }

  .doc-main-title {
    font-size: 20px;
    font-weight: 800;
    margin: 4px 0 2px 0;
    letter-spacing: -0.02em;
  }

  .doc-subtitle {
    font-size: 11px;
    color: #64748b;
  }

  .doc-meta-badge {
    text-align: right;
  }

  .meta-label {
    font-size: 9px;
    color: #64748b;
    display: block;
    font-weight: 600;
  }

  .meta-val {
    font-size: 12px;
    font-weight: 700;
    font-family: monospace;
  }

  .section-heading {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #1e293b;
    margin: 0 0 8px 0;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
  }

  .report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .report-table td {
    padding: 6px 4px;
  }

  .col-lbl {
    width: 200px;
    color: #475569;
    font-weight: 500;
  }

  .col-val {
    color: #0f172a;
  }

  .col-val.strong {
    font-weight: 700;
  }

  .col-val.mono {
    font-family: monospace;
  }

  .col-val.numbers {
    font-variant-numeric: tabular-nums;
  }

  .border-table {
    border: 1px solid #cbd5e1;
  }

  .border-table th {
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
  }

  .border-table td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    font-size: 11px;
  }

  .mono-code {
    font-family: monospace;
    font-weight: 700;
    color: #c2410c;
  }

  .planning-box {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .zone-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pill-badge {
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 4px;
  }

  .zone-details {
    display: flex;
    flex-direction: column;
  }

  .zone-title {
    font-size: 13px;
    font-weight: 700;
  }

  .zone-sub {
    font-size: 11px;
    color: #64748b;
  }

  .statutory-note {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
    margin: 0;
  }

  .no-overlays-text {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
  }

  .doc-footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .disclaimer-text {
    font-size: 10px;
    line-height: 1.4;
    color: #94a3b8;
    margin: 0;
  }

  .doc-seal {
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @media (max-width: 640px) {
    .report-overlay {
      padding: 8px;
    }
    .report-modal {
      max-height: 96vh;
    }
    .printable-document {
      padding: 16px;
    }
    .col-lbl {
      width: 120px;
    }
  }

  @media print {
    .no-print {
      display: none !important;
    }
    .report-overlay {
      position: static;
      background: none;
      padding: 0;
    }
    .report-modal {
      max-width: 100%;
      box-shadow: none;
      max-height: none;
    }
    .printable-document {
      padding: 0;
    }
  }
</style>
