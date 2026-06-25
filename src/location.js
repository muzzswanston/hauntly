import { supabase } from '../lib/supabaseClient'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

if (!slug) {
  document.body.innerHTML = `
    <div style="padding:2rem;color:white;background:#08080d;font-family:Georgia;">
      <h1>Location not found</h1>
      <a href="/" style="color:#c9a24e;">Return to Mystery Atlas</a>
    </div>
  `
  throw new Error('No slug provided')
}

loadLocation()

async function loadLocation() {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      showNotFound()
      return
    }

    populatePage(data)
    setupEvidenceLegend()
    trackLocationView(data)
    await loadRelatedOrNearbyLocations(data)
  } catch (err) {
    console.error(err)
    showNotFound()
  }
}

function populatePage(location) {
  document.title = `${location.name} | Mystery Atlas`

  const heroImage = document.getElementById('heroImage')

  if (heroImage) {
    heroImage.src =
      location.image_url ||
      'https://placehold.co/1200x600/111111/e8d39a?text=Mystery+Atlas'

    heroImage.alt = location.name
  }

  setText('title', location.name)

  setText(
    'description',
    location.full_description ||
      location.short_description ||
      'No description available.'
  )

  setText(
    'history',
    location.history ||
      'No historical information available.'
  )

  setText(
    'activity',
    location.reported_activity ||
      'No paranormal reports available.'
  )

  setText(
    'visitorInfo',
    location.visitor_info ||
      'No visitor information available.'
  )

  addWhyItMattersSection(location)
  addCaseFileSection(location)
  buildMetaPanel(location)
}
}

function addWhyItMattersSection(location) {
  if (!location.why_it_matters) return

  const descriptionSection = document.getElementById('description')?.closest('.section')
  if (!descriptionSection) return

  const existing = document.getElementById('whyItMatters')
  if (existing) {
    existing.textContent = location.why_it_matters
    return
  }

  const section = document.createElement('div')
  section.className = 'section'
  section.innerHTML = `
    <h2>Why It Matters</h2>
    <p id="whyItMatters">${escapeHtml(location.why_it_matters)}</p>
  `

  descriptionSection.insertAdjacentElement('afterend', section)
}

function addCaseFileSection(location) {
  if (!location.has_case_file || !location.case_file_slug) return

  const historySection = document.getElementById('history')?.closest('.section')
  if (!historySection) return

  const section = document.createElement('div')
  section.className = 'section'

  section.innerHTML = `
    <h2>Official Case File</h2>

    <p>
      Explore the complete investigation including the timeline,
      evidence, theories and verdict.
    </p>

    <a
      href="/casefile.html?slug=${encodeURIComponent(location.case_file_slug)}"
      style="
        display:inline-block;
        margin-top:10px;
        background:#c9a24e;
        color:#111;
        padding:10px 16px;
        border-radius:999px;
        text-decoration:none;
        font-weight:bold;
        font-family:Arial, sans-serif;
      "
    >
      Open Case File →
    </a>
  `

  historySection.insertAdjacentElement('beforebegin', section)
}

function trackLocationView(location) {
  if (!window.umami) return

  window.umami.track('Location Viewed', {
    location: location.name,
    category: location.category || 'Unknown',
    region: location.region || 'Unknown'
  })
}

async function loadRelatedOrNearbyLocations(currentLocation) {
  const container = document.getElementById('nearbyList')
  if (!container) return

  if (currentLocation.related_slugs && currentLocation.related_slugs.length > 0) {
    await loadRelatedLocations(currentLocation, container)
    return
  }

  await loadNearbyLocations(currentLocation, container)
}

async function loadRelatedLocations(currentLocation, container) {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .in('slug', currentLocation.related_slugs)
      .eq('status', 'Published')

    if (error || !data || !data.length) {
      await loadNearbyLocations(currentLocation, container)
      return
    }

    const ordered = currentLocation.related_slugs
      .map((relatedSlug) => data.find((item) => item.slug === relatedSlug))
      .filter(Boolean)

    container.innerHTML = ordered
      .map((item) => buildLocationCard(item, currentLocation, true))
      .join('')
  } catch (err) {
    console.error(err)
    await loadNearbyLocations(currentLocation, container)
  }
}

async function loadNearbyLocations(currentLocation, container) {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('status', 'Published')
      .neq('id', currentLocation.id)

    if (error || !data) {
      container.innerHTML = '<p>Could not load nearby mysteries.</p>'
      return
    }

    const nearby = data
      .filter((item) => item.latitude && item.longitude)
      .map((item) => ({
        ...item,
        distance_km: calculateDistanceKm(
          Number(currentLocation.latitude),
          Number(currentLocation.longitude),
          Number(item.latitude),
          Number(item.longitude)
        )
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 5)

    if (!nearby.length) {
      container.innerHTML = '<p>No nearby mysteries found.</p>'
      return
    }

    container.innerHTML = nearby
      .map((item) => buildLocationCard(item, currentLocation, false))
      .join('')
  } catch (err) {
    console.error(err)
    container.innerHTML = '<p>Could not load nearby mysteries.</p>'
  }
}

function buildLocationCard(item, currentLocation, isRelated) {
  const distanceText =
    !isRelated && item.distance_km
      ? ` • ${Math.round(item.distance_km)} km away`
      : ''

  return `
    <a
      href="/location.html?slug=${escapeHtml(item.slug)}"
      onclick="window.umami?.track('${isRelated ? 'Related Mystery Click' : 'Nearby Mystery Click'}', {
        location: '${escapeAttribute(item.name)}',
        category: '${escapeAttribute(item.category || 'Unknown')}'
      })"
      style="
        display:block;
        margin:.75rem 0;
        color:#e8d39a;
        text-decoration:none;
        padding:.75rem;
        background:#1b1b2f;
        border-radius:8px;
      "
    >
      <strong>${escapeHtml(item.name)}</strong><br>

      <small>
        ${escapeHtml(item.category || 'Unknown')}
        • ${escapeHtml(item.location_type || 'Mystery')}
        ${distanceText}
      </small><br>

      <span>${escapeHtml(item.short_description || '')}</span>
    </a>
  `
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusKm * c
}

function toRadians(value) {
  return value * Math.PI / 180
}

function buildMetaPanel(location) {
  const panel = document.getElementById('metaPanel')

  if (!panel) return

  const score =
    location.mystery_score
      ? `${location.mystery_score}/10`
      : 'N/A'

  const stars = renderStars(location.mystery_score)

  panel.innerHTML = `
    <div class="meta-item">
      <strong>Category</strong><br>
      ${escapeHtml(location.category || 'Unknown')}
    </div>

    <div class="meta-item">
      <strong>Type</strong><br>
      ${escapeHtml(location.location_type || 'Unknown')}
    </div>

<div class="meta-item">
  <strong>
    Evidence Level
    <button
      id="evidenceHelp"
      type="button"
      style="
        width:22px;
        height:22px;
        margin-left:6px;
        border-radius:999px;
        border:1px solid #c9a24e;
        background:#101018;
        color:#c9a24e;
        cursor:pointer;
        font-weight:bold;
      "
      title="Evidence level guide"
    >
      ?
    </button>
  </strong>
  <br>

  <span
    style="
      display:inline-block;
      margin-top:6px;
      padding:4px 10px;
      border-radius:999px;
      background:${getEvidenceBadgeColor(location.evidence_level)};
      color:white;
      font-size:.8rem;
      font-weight:bold;
      text-transform:uppercase;
    "
  >
    ${escapeHtml(location.evidence_level || 'Unknown')}
  </span>
</div>

<div class="meta-item">
  <strong>Status</strong><br>
  ${escapeHtml(location.status || 'Unknown')}
</div>

    <div class="meta-item">
      <strong>Mystery Score</strong><br>
      <span style="color:#c9a24e;letter-spacing:1px;">
        ${stars}
      </span>
      <br>
      ${score}
    </div>

    <div class="meta-item">
      <strong>Location</strong><br>
      ${escapeHtml(
        [location.city, location.region, location.country]
          .filter(Boolean)
          .join(', ')
      )}
    </div>

    ${
      location.year_established
        ? `
        <div class="meta-item">
          <strong>Established</strong><br>
          ${location.year_established}
        </div>
      `
        : ''
    }

    ${
      location.access_notes
        ? `
        <div class="meta-item">
          <strong>Access</strong><br>
          ${escapeHtml(location.access_notes)}
        </div>
      `
        : ''
    }

    ${
      location.source_url
        ? `
        <div class="meta-item">
          <a
            href="${escapeHtml(location.source_url)}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="window.umami?.track('Source Link Click', {
              location: '${escapeAttribute(location.name)}'
            })"
          >
            Source Information
          </a>
        </div>
      `
        : ''
    }

    ${
      location.affiliate_url
        ? `
        <div class="meta-item">
          <a
            href="${escapeHtml(location.affiliate_url)}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="window.umami?.track('Affiliate Click', {
              location: '${escapeAttribute(location.name)}'
            })"
          >
            Book / Explore Nearby
          </a>
        </div>
      `
        : ''
    }
  `
}

function setupEvidenceLegend() {
  const help = document.getElementById('evidenceHelp')
  const modal = document.getElementById('evidenceLegendModal')
  const close = document.getElementById('closeEvidenceLegend')

  if (!help || !modal) return

  help.onclick = () => {
    modal.style.display = 'block'
  }

  if (close) {
    close.onclick = () => {
      modal.style.display = 'none'
    }
  }

  modal.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none'
    }
  }
}


function setText(id, value) {
  const element = document.getElementById(id)

  if (element) {
    element.textContent = value
  }
}

function showNotFound() {
  document.body.innerHTML = `
    <div style="
      background:#08080d;
      color:#e0d8c3;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-direction:column;
      font-family:Georgia;
      padding:2rem;
    ">
      <h1>Mystery Not Found</h1>

      <p>
        The mystery you are looking for does not exist
        or may have been removed.
      </p>

      <a
        href="/"
        style="
          color:#c9a24e;
          margin-top:1rem;
          text-decoration:none;
        "
      >
        Return to Mystery Atlas
      </a>
    </div>
  `
}

function renderStars(score) {
  const value = Math.max(0, Math.min(10, Number(score) || 0))
  const rounded = Math.round(value)

  return '★'.repeat(rounded) + '☆'.repeat(10 - rounded)
}

function escapeAttribute(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function getEvidenceBadgeColor(level) {
  switch (String(level || '').toLowerCase()) {
    case 'verified':
      return '#2ecc71'

    case 'documented':
      return '#c9a24e'

    case 'folklore':
      return '#9b59b6'

    case 'researching':
      return '#ff9800'

    case 'user submitted':
      return '#3498db'

    default:
      return '#95a5a6'
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
