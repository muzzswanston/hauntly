import { supabase } from '../lib/supabaseClient'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')
const caseContent = document.getElementById('caseContent')

if (!slug) {
  showNotFound()
  throw new Error('No case file slug provided')
}

loadCaseFile()

async function loadCaseFile() {
  try {
    const { data, error } = await supabase
      .from('case_files')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !data) {
      showNotFound()
      return
    }

    renderCaseFile(data)
  } catch (err) {
    console.error(err)
    showNotFound()
  }
}

function renderCaseFile(caseFile) {
  document.title = `${caseFile.title} | Mystery Atlas Case File`

  caseContent.innerHTML = `
    <header class="case-header">
      <div class="status">${escapeHtml(caseFile.status || 'Unresolved')}</div>

      <h1>Case File ${escapeHtml(caseFile.case_number || '')}: ${escapeHtml(caseFile.title || 'Untitled Case')}</h1>

      ${
        caseFile.subtitle
          ? `<p class="subtitle">${escapeHtml(caseFile.subtitle)}</p>`
          : ''
      }

      <div class="meta">
        ${metaBox('Date', caseFile.incident_date)}
        ${metaBox('Location', caseFile.location_name)}
        ${metaBox('Category', caseFile.category)}
        ${metaBox('Classification', caseFile.classification)}
      </div>
    </header>

    ${section('Executive Summary', caseFile.executive_summary)}

    ${renderTimeline(caseFile.timeline)}

    ${renderEvidence(caseFile.evidence)}

    ${renderTheories(caseFile.theories)}

    ${section('Unanswered Questions', caseFile.unanswered_questions)}

    <section class="verdict">
      <p><strong>Case Status:</strong> ${escapeHtml(caseFile.status || 'Unresolved')}</p>
      <p>${escapeHtml(caseFile.verdict || 'No verdict available.')}</p>
    </section>

    ${
      caseFile.source_url
        ? `
          <section class="section">
            <h2>Source</h2>
            <p>
              <a
                href="${escapeHtml(caseFile.source_url)}"
                target="_blank"
                rel="noopener noreferrer"
                style="color:#c9a24e;"
              >
                View source information
              </a>
            </p>
          </section>
        `
        : ''
    }
  `
}

function metaBox(label, value) {
  if (!value) return ''

  return `
    <div>
      <strong>${escapeHtml(label)}</strong><br>
      ${escapeHtml(value)}
    </div>
  `
}

function section(title, content) {
  if (!content) return ''

  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(content)}</p>
    </section>
  `
}

function renderTimeline(items) {
  if (!Array.isArray(items) || !items.length) return ''

  return `
    <section class="section">
      <h2>Timeline of Events</h2>

      ${items
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${escapeHtml(item.time || '')}</strong><br>
              ${escapeHtml(item.detail || '')}
            </div>
          `
        )
        .join('')}
    </section>
  `
}

function renderEvidence(items) {
  if (!Array.isArray(items) || !items.length) return ''

  return `
    <section class="section">
      <h2>Evidence Noted</h2>

      ${items
        .map(
          (item) => `
            <div class="theory">
              <h3>${escapeHtml(item.label || '')}</h3>
              <p>${escapeHtml(item.detail || '')}</p>
            </div>
          `
        )
        .join('')}
    </section>
  `
}

function renderTheories(items) {
  if (!Array.isArray(items) || !items.length) return ''

  return `
    <section class="section">
      <h2>Possible Explanations</h2>

      ${items
        .map(
          (item) => `
            <div class="theory">
              <h3>${escapeHtml(item.title || '')}</h3>
              <p>${escapeHtml(item.summary || '')}</p>
              ${
                item.evidence_strength
                  ? `<span class="rating">Evidence strength: ${escapeHtml(item.evidence_strength)}</span>`
                  : ''
              }
            </div>
          `
        )
        .join('')}
    </section>
  `
}

function showNotFound() {
  if (!caseContent) return

  caseContent.innerHTML = `
    <section class="section">
      <h1>Case File Not Found</h1>
      <p>The case file you are looking for does not exist or is not published yet.</p>
      <a href="/" style="color:#c9a24e;">Return to Mystery Atlas</a>
    </section>
  `
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
