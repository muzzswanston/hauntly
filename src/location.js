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
    await loadNearbyLocations(data)
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

  buildMetaPanel(location)
}

async function loadNearbyLocations(currentLocation) {
  const container = document.getElementById('nearbyList')

  if (!container) return

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
      .map(
        (item) => `
        <a
          href="/location.html?slug=${escapeHtml(item.slug)}"
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
            • ${Math.round(item.distance_km)} km away
          </small><br>
          <span>${escapeHtml(item.short_description || '')}</span>
        </a>
      `
      )
      .join('')
  } catch (err) {
    console.error(err)

    container.innerHTML =
      '<p>Could not load nearby mysteries.</p>'
  }
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
          >
            Book / Explore Nearby
          </a>
        </div>
      `
        : ''
    }
  `
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
