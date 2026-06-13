import { supabase } from '../lib/supabaseClient'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

if (!API_KEY) {
  document.body.innerHTML =
    '<div style="background:#000;color:#ff6b6b;text-align:center;padding:4rem;font-family:Georgia;"><h1>API Key Missing</h1><p>Add <strong>VITE_GOOGLE_MAPS_API_KEY</strong> in Vercel Environment Variables</p></div>'
} else {
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&callback=initMap&libraries=geometry`
  script.async = true
  document.head.appendChild(script)
}

let map
let allLocations = []
let filteredLocations = []
let markers = []
let infoWindow
let selectedCategory = 'All'
let leyLinesVisible = false
let leyLinePolylines = []
let userMarker = null

const DEFAULT_CENTER = { lat: -25.2744, lng: 133.7751 }
const DEFAULT_ZOOM = 4

const CATEGORY_ICONS = {
  Haunted: '👻',
  UFO: '🛸',
  Folklore: '📜',
  Cryptid: '🐾',
  Unexplained: '❓'
}

window.initMap = async function initMap() {
  trackEvent('Map Loaded')

  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#1b1b1f' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1f' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#c9a24e' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#101827' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2b2b31' }] }
    ]
  })

  infoWindow = new google.maps.InfoWindow()

  setupEventListeners()
  setupLeyLines()
  await loadLocations()
}

async function loadLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .in('status', ['Published', 'Researching'])
    .order('name', { ascending: true })

  if (error) {
    console.error('Error loading locations:', error)
    alert('Could not load Mystery Atlas locations from Supabase.')
    return
  }

  allLocations = data || []
  filteredLocations = [...allLocations]

  renderLocations()
  renderResults()
  updateSubtitle()
}

function setupEventListeners() {
  const searchInput = document.getElementById('searchInput') || document.getElementById('searchBox')
  const categoryButtons = document.querySelectorAll('[data-category], .category-pill')
  const gpsButton = document.getElementById('gpsButton') || document.getElementById('gpsBtn')
  const leyLinesButton = document.getElementById('leyLinesButton') || document.getElementById('leyToggle')
  const mapViewBtn = document.getElementById('mapViewBtn')
  const listViewBtn = document.getElementById('listViewBtn')
  const submitForm = document.getElementById('submitMysteryForm')
  const submitToggle = document.getElementById('submitToggle')
  const submitPanel = document.getElementById('submitPanel')
  const submitBtn = document.getElementById('submitMysteryBtn')
  const closeSubmitPanel = document.getElementById('closeSubmitPanel')
  const filterToggle = document.getElementById('filterToggle')
  const filtersPanel = document.getElementById('filtersPanel')

  const legendToggle = document.getElementById('legendToggle')
  const legendPanel = document.getElementById('legendPanel')
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters)
  }

  if (legendToggle && legendPanel) {
  legendToggle.onclick = () => {
    trackEvent('Toggle Evidence Legend')

    legendPanel.style.display =
      legendPanel.style.display === 'none' || legendPanel.style.display === ''
        ? 'block'
        : 'none'
  }
}
  
  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedCategory = button.dataset.category || button.textContent.trim() || 'All'

      categoryButtons.forEach((btn) => btn.classList.remove('active'))
      button.classList.add('active')

      trackEvent('Filter Category', { category: selectedCategory })
      applyFilters()

      if (filtersPanel && window.innerWidth <= 800) {
        filtersPanel.style.display = 'none'
      }
    })
  })

  if (gpsButton) gpsButton.addEventListener('click', centerOnUser)
  if (leyLinesButton) leyLinesButton.addEventListener('click', toggleLeyLines)

  if (mapViewBtn && listViewBtn) {
    mapViewBtn.addEventListener('click', () => setMobileView('map'))
    listViewBtn.addEventListener('click', () => setMobileView('list'))
  }

  if (submitForm) {
    submitForm.addEventListener('submit', handleSubmitMystery)
  }

  if (submitToggle && submitPanel) {
    submitToggle.onclick = () => {
      trackEvent('Open Submit Form')
      submitPanel.style.display =
        submitPanel.style.display === 'none' || submitPanel.style.display === ''
          ? 'block'
          : 'none'
    }
  }

  if (closeSubmitPanel && submitPanel) {
    closeSubmitPanel.onclick = () => {
      trackEvent('Close Submit Form')
      submitPanel.style.display = 'none'
    }
  }

  if (submitBtn) {
    submitBtn.onclick = handleSubmitMysteryFromPanel
  }

  if (filterToggle && filtersPanel) {
    filterToggle.onclick = () => {
      trackEvent('Toggle Filters')
      filtersPanel.style.display =
        filtersPanel.style.display === 'none' || filtersPanel.style.display === ''
          ? 'block'
          : 'none'
    }
  }
}

function applyFilters() {
  const searchInput = document.getElementById('searchInput') || document.getElementById('searchBox')
  const query = searchInput ? searchInput.value.toLowerCase().trim() : ''

  if (query.length >= 2) trackEvent('Search')

  filteredLocations = allLocations.filter((location) => {
    const matchesCategory =
      selectedCategory === 'All' || location.category === selectedCategory

    const searchableText = [
      location.name,
      location.city,
      location.region,
      location.country,
      location.category,
      location.location_type,
      location.short_description,
      location.why_it_matters,
      location.evidence_level,
      location.status
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return matchesCategory && (!query || searchableText.includes(query))
  })

  renderLocations()
  renderResults()
  updateSubtitle()
}

function renderLocations() {
  clearMarkers()

  filteredLocations.forEach((location) => {
    if (!location.latitude || !location.longitude) return

    const marker = new google.maps.Marker({
      position: {
        lat: Number(location.latitude),
        lng: Number(location.longitude)
      },
      map,
      title: location.name,
      icon: createMarkerIcon(location.category, location)
    })

    marker.addListener('click', () => openLocationInfo(location, marker))
    markers.push(marker)
  })

  fitMapToMarkers()
}

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null))
  markers = []
}

function getEvidenceColor(location) {
  if (location.status === 'Researching') return '#ff9800'

  switch (location.evidence_level) {
    case 'Verified':
      return '#2ecc71'
    case 'Documented':
      return '#c9a24e'
    case 'Folklore':
      return '#9b59b6'
    case 'Researching':
      return '#ff9800'
    case 'User Submitted':
      return '#3498db'
    default:
      return '#c9a24e'
  }
}

function createMarkerIcon(category, location) {
  const emoji = CATEGORY_ICONS[category] || '❓'
  const strokeColor = getEvidenceColor(location)

  const svg = `
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="18" fill="#111318" stroke="${strokeColor}" stroke-width="4"/>
      <text x="22" y="28" text-anchor="middle" font-size="20">${emoji}</text>
    </svg>
  `

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22)
  }
}

function openLocationInfo(location, marker) {
  trackEvent('Open Map Popup', {
    location: location.name,
    category: location.category || 'Unknown',
    status: location.status || 'Unknown'
  })

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
  const stars = renderStars(location.mystery_score)

  const imageHtml = location.image_url
    ? `<img class="info-image" src="${escapeHtml(location.image_url)}" alt="${escapeHtml(location.image_alt_text || location.name)}" />`
    : ''

  const imageCreditHtml =
    location.image_credit || location.image_license || location.image_source
      ? `
        <div class="image-credit">
          ${location.image_credit ? `Credit: ${escapeHtml(location.image_credit)}` : ''}
          ${location.image_license ? ` • ${escapeHtml(location.image_license)}` : ''}
          ${
            location.image_source
              ? ` • <a href="${escapeHtml(location.image_source)}" target="_blank" rel="noopener">Image source</a>`
              : ''
          }
        </div>
      `
      : ''

  const infoHtml = `
    <div class="info-window" style="max-width:290px;font-family:Georgia;color:#111;">
      ${imageHtml}
      ${imageCreditHtml}

      <h3 style="margin:0 0 8px;">
        <a
          href="/location.html?slug=${escapeHtml(location.slug)}"
          target="_blank"
          onclick="window.umami?.track('View Full Mystery', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
          style="color:#2d1b69;text-decoration:none;"
        >
          ${escapeHtml(location.name)}
        </a>
      </h3>

      <div class="badge-row">
        ${getStatusBadge(location)}
        ${getEvidenceBadge(location)}
      </div>

      <p style="margin:6px 0;">
        <strong>${escapeHtml(location.category || 'Unknown')}</strong>
        ${location.location_type ? ` • ${escapeHtml(location.location_type)}` : ''}
      </p>

      <p style="margin:0 0 4px;color:#c9a24e;letter-spacing:1px;">${stars}</p>
      <p style="margin:0 0 8px;"><strong>Mystery Score:</strong> ${location.mystery_score || '?'}/10</p>

      ${location.short_description ? `<p>${escapeHtml(location.short_description)}</p>` : ''}

      ${
        location.status === 'Researching'
          ? `
            <p style="padding:8px;background:#fff3cd;color:#5c4200;border-radius:8px;font-size:.85rem;">
              This mystery is currently being researched. Details may change as more sources are reviewed.
            </p>
          `
          : ''
      }

      ${location.why_it_matters ? `<p><strong>Why it matters:</strong> ${escapeHtml(location.why_it_matters)}</p>` : ''}
      ${location.access_notes ? `<p><strong>Access:</strong> ${escapeHtml(location.access_notes)}</p>` : ''}
      ${location.visitor_info ? `<p><strong>Visitor info:</strong> ${escapeHtml(location.visitor_info)}</p>` : ''}

      <a
        href="/location.html?slug=${escapeHtml(location.slug)}"
        target="_blank"
        onclick="window.umami?.track('View Full Mystery', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
        style="display:block;background:#6c5ce7;color:white;text-align:center;text-decoration:none;padding:10px;border-radius:8px;margin:8px 0;font-weight:bold;"
      >
        View Full Mystery
      </a>

      <a
        href="${mapsUrl}"
        target="_blank"
        rel="noopener noreferrer"
        onclick="window.umami?.track('Get Directions', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
        style="display:block;background:#c9a24e;color:white;text-align:center;text-decoration:none;padding:10px;border-radius:8px;margin-bottom:8px;font-weight:bold;"
      >
        Directions
      </a>

      ${
        location.source_url
          ? `<a href="${escapeHtml(location.source_url)}" target="_blank" rel="noopener noreferrer">View source</a>`
          : ''
      }

      ${
        location.affiliate_url
          ? `<a href="${escapeHtml(location.affiliate_url)}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:6px;">Book or explore nearby</a>`
          : ''
      }
    </div>
  `

  infoWindow.setContent(infoHtml)
  infoWindow.open(map, marker)
}

function renderResults() {
  const resultsList = document.getElementById('resultsList')
  if (!resultsList) return

  resultsList.innerHTML = ''

  if (filteredLocations.length === 0) {
    resultsList.innerHTML = `<div class="empty-state">No mysteries found. Try another search or category.</div>`
    return
  }

  filteredLocations.forEach((location) => {
    const card = document.createElement('button')
    card.className = 'result-card result-item'
    card.type = 'button'

    card.innerHTML = `
      <div class="result-header">
        <strong>${escapeHtml(location.name)}</strong>
      </div>

      <div class="badge-row">
        ${getStatusBadge(location)}
        ${getEvidenceBadge(location)}
      </div>

      <div class="result-meta">
        ${escapeHtml(location.category || 'Unknown')}
        ${location.city ? ` • ${escapeHtml(location.city)}` : ''}
        ${location.region ? `, ${escapeHtml(location.region)}` : ''}
      </div>

      ${location.short_description ? `<p>${escapeHtml(location.short_description)}</p>` : ''}
    `

    card.addEventListener('click', () => {
      const marker = markers.find(
        (m) =>
          Number(m.getPosition().lat()).toFixed(6) === Number(location.latitude).toFixed(6) &&
          Number(m.getPosition().lng()).toFixed(6) === Number(location.longitude).toFixed(6)
      )

      trackEvent('Click Result List Item', {
        location: location.name,
        category: location.category || 'Unknown'
      })

      if (location.latitude && location.longitude) {
        map.setCenter({
          lat: Number(location.latitude),
          lng: Number(location.longitude)
        })
        map.setZoom(12)
      }

      if (marker) openLocationInfo(location, marker)
      setMobileView('map')
    })

    resultsList.appendChild(card)
  })
}

function getStatusBadge(location) {
  if (location.status === 'Researching') {
    return `
      <span
        style="
          display:inline-block;
          padding:2px 8px;
          border-radius:999px;
          background:#ff9800;
          color:white;
          font-size:.75rem;
          font-weight:bold;
          text-transform:uppercase;
        "
      >
        Researching
      </span>
    `
  }

  return ''
}

function getEvidenceBadge(location) {
  const level = location.evidence_level
  if (!level) return ''

  const color = getEvidenceColor(location)

  return `
    <span
      style="
        display:inline-block;
        padding:2px 8px;
        border-radius:999px;
        background:${color};
        color:white;
        font-size:.75rem;
        font-weight:bold;
        text-transform:uppercase;
      "
    >
      ${escapeHtml(level)}
    </span>
  `
}

function fitMapToMarkers() {
  if (!map) return

  if (markers.length === 0) {
    map.setCenter(DEFAULT_CENTER)
    map.setZoom(DEFAULT_ZOOM)
    return
  }

  if (markers.length === 1) {
    map.setCenter(markers[0].getPosition())
    map.setZoom(12)
    return
  }

  const bounds = new google.maps.LatLngBounds()
  markers.forEach((marker) => bounds.extend(marker.getPosition()))
  map.fitBounds(bounds)
}

function updateSubtitle() {
  const subtitle = document.getElementById('subtitle') || document.querySelector('.subtitle')
  if (!subtitle) return

  subtitle.textContent = `${filteredLocations.length} mysteries mapped • Mapping the Unexplained`
}

function centerOnUser() {
  trackEvent('Near Me Click')

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.')
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      trackEvent('Near Me Success')

      const userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      map.setCenter(userPosition)
      map.setZoom(12)

      if (userMarker) userMarker.setMap(null)

      userMarker = new google.maps.Marker({
        position: userPosition,
        map,
        title: 'Your location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4fc3f7',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      })
    },
    () => {
      trackEvent('Near Me Failed')
      alert('Unable to access your location.')
    }
  )
}

function setupLeyLines() {
  const leyLinePaths = [
    [{ lat: 51.1789, lng: -1.8262 }, { lat: 29.9792, lng: 31.1342 }],
    [{ lat: -25.3444, lng: 131.0369 }, { lat: -13.1631, lng: -72.545 }],
    [{ lat: 41.4099, lng: -122.1944 }, { lat: 25.0, lng: -71.0 }],
    [{ lat: -33.8688, lng: 151.2093 }, { lat: -37.8136, lng: 144.9631 }]
  ]

  leyLinePolylines = leyLinePaths.map((path) => {
    return new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#c9a24e',
      strokeOpacity: 0.7,
      strokeWeight: 2
    })
  })
}

function toggleLeyLines() {
  leyLinesVisible = !leyLinesVisible

  trackEvent('Toggle Ley Lines', {
    visible: leyLinesVisible ? 'true' : 'false'
  })

  leyLinePolylines.forEach((line) => {
    line.setMap(leyLinesVisible ? map : null)
  })

  const leyLinesButton = document.getElementById('leyLinesButton') || document.getElementById('leyToggle')
  if (leyLinesButton) {
    leyLinesButton.textContent = leyLinesVisible ? '✕' : '⚡'
  }
}

function setMobileView(view) {
  const app = document.body
  const mapViewBtn = document.getElementById('mapViewBtn')
  const listViewBtn = document.getElementById('listViewBtn')

  if (view === 'list') {
    app.classList.add('list-view', 'show-list')
    app.classList.remove('map-view', 'show-map')
    mapViewBtn?.classList.remove('active')
    listViewBtn?.classList.add('active')
  } else {
    app.classList.add('map-view', 'show-map')
    app.classList.remove('list-view', 'show-list')
    listViewBtn?.classList.remove('active')
    mapViewBtn?.classList.add('active')

    setTimeout(() => {
      google.maps.event.trigger(map, 'resize')
      fitMapToMarkers()
    }, 100)
  }
}

async function handleSubmitMystery(event) {
  event.preventDefault()

  const form = event.target
  const formData = new FormData(form)

  await submitMystery({
    name: String(formData.get('name') || '').trim(),
    category: String(formData.get('category') || 'Unexplained').trim(),
    description: String(formData.get('description') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    region: String(formData.get('region') || '').trim()
  })

  form.reset()
}

async function handleSubmitMysteryFromPanel() {
  await submitMystery({
    name: document.getElementById('submitName')?.value.trim() || '',
    category: document.getElementById('submitCategory')?.value || 'Unexplained',
    description: document.getElementById('submitStory')?.value.trim() || '',
    city: document.getElementById('submitCity')?.value.trim() || '',
    region: document.getElementById('submitRegion')?.value.trim() || '',
    latitude: Number(document.getElementById('submitLat')?.value),
    longitude: Number(document.getElementById('submitLng')?.value)
  })
}

async function submitMystery({ name, category, description, city, region, latitude, longitude }) {
  if (!name || !description) {
    trackEvent('Submit Form Validation Error')
    alert('Please add a name and description.')
    return
  }

  const submission = {
    name,
    slug: `${createSlug(name)}-${Date.now()}`,
    category,
    location_type: 'Unknown',
    country: 'Australia',
    region,
    city,
    short_description: description,
    mystery_score: 5,
    tags: [category, 'User Submitted'],
    is_featured: false,
    status: 'Needs Review',
    evidence_level: 'User Submitted'
  }

  if (!Number.isNaN(latitude)) submission.latitude = latitude
  if (!Number.isNaN(longitude)) submission.longitude = longitude

  const { error } = await supabase.from('locations').insert(submission)

  if (error) {
    console.error('Error submitting mystery:', error)
    trackEvent('Mystery Submission Failed')
    alert('Something went wrong. Please try again.')
    return
  }

  trackEvent('Mystery Submitted', {
    category,
    region: region || 'Unknown'
  })

  alert('Mystery submitted for review.')

  const submitPanel = document.getElementById('submitPanel')
  if (submitPanel) submitPanel.style.display = 'none'

  ;['submitName', 'submitCity', 'submitRegion', 'submitLat', 'submitLng', 'submitStory'].forEach((id) => {
    const field = document.getElementById(id)
    if (field) field.value = ''
  })
}

function createSlug(value) {
  return value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function renderStars(score) {
  const value = Math.max(0, Math.min(10, Number(score) || 0))
  const rounded = Math.round(value)

  return '★'.repeat(rounded) + '☆'.repeat(10 - rounded)
}

function trackEvent(eventName, eventData = {}) {
  if (window.umami) {
    window.umami.track(eventName, eventData)
  }
}

function escapeAttribute(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
