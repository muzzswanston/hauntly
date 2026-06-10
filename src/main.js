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

const HAUNTED_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%236c5ce7' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E"

const UFO_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%239458ff' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%9B%B8%3C/text%3E%3C/svg%3E"

const FOLKLORE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23c9a24e' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%93%9C%3C/text%3E%3C/svg%3E"

const CRYPTID_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%2327ae60' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%90%BE%3C/text%3E%3C/svg%3E"

const UNEXPLAINED_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23ff6b6b' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%3F%3C/text%3E%3C/svg%3E"

const USER_LOCATION_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%230098ff' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%93%8D%3C/text%3E%3C/svg%3E"

let map
let allLocations = []
let allMarkers = []
let leyLines = []
let leyVisible = false
let activeCategory = 'All'
let userMarker = null
let searchTracked = false

window.initMap = async function () {
  trackEvent('Map Loaded')

  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 4,
    center: { lat: -25.2744, lng: 133.7751 },
    styles: [
      { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
      { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
    ]
  })

  await loadLocations()
  setupButtons()
  setupCategoryFilters()
  setupSearch()
  setupSubmitMystery()
  setupMobileViewTabs()
}

async function loadLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'Published')
    .order('name', { ascending: true })

  if (error) {
    console.error('Supabase error:', error)
    alert('Could not load Mystery Atlas locations from Supabase.')
    return
  }

  allLocations = data || []
  renderMarkers(allLocations, false)
  updateLocationCount(allLocations.length)
}

function renderMarkers(locations, shouldFitMap = true) {
  clearMarkers()

  locations.forEach((location) => {
    if (!location.latitude || !location.longitude) return

    const marker = new google.maps.Marker({
      position: {
        lat: Number(location.latitude),
        lng: Number(location.longitude)
      },
      map,
      title: location.name,
      icon: {
        url: getIconForLocation(location),
        scaledSize: new google.maps.Size(40, 40)
      }
    })

    const infoWindow = new google.maps.InfoWindow({
      content: buildInfoWindowContent(location)
    })

    marker.addListener('click', () => {
      trackEvent('Open Map Popup', {
        location: location.name,
        category: location.category || 'Unknown'
      })

      infoWindow.open(map, marker)
    })

    allMarkers.push({ marker, location, infoWindow })
  })

  renderResultsList(locations)

  if (shouldFitMap) {
    fitMapToLocations(locations)
  }
}

function clearMarkers() {
  allMarkers.forEach((item) => item.marker.setMap(null))
  allMarkers = []
}

function renderResultsList(locations) {
  const resultsList = document.getElementById('resultsList')
  if (!resultsList) return

  if (!locations.length) {
    resultsList.innerHTML = '<p>No mysteries found.</p>'
    return
  }

  resultsList.innerHTML = locations.map((location, index) => `
    <div class="result-item" data-index="${index}">
      <h4>${escapeHtml(location.name)}</h4>
      <p>${escapeHtml(location.category || 'Unknown')} • ${escapeHtml(location.city || location.region || '')}</p>
      <p>${escapeHtml(location.short_description || '')}</p>
    </div>
  `).join('')

  document.querySelectorAll('.result-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const matched = allMarkers[index]
      if (!matched) return

      trackEvent('Click Result List Item', {
        location: matched.location.name,
        category: matched.location.category || 'Unknown'
      })

      showMapView()

      map.setCenter({
        lat: Number(matched.location.latitude),
        lng: Number(matched.location.longitude)
      })

      map.setZoom(12)
      matched.infoWindow.open(map, matched.marker)
    })
  })
}

function fitMapToLocations(locations) {
  const validLocations = locations.filter((location) => location.latitude && location.longitude)

  if (!validLocations.length) return

  if (validLocations.length === 1) {
    map.setCenter({
      lat: Number(validLocations[0].latitude),
      lng: Number(validLocations[0].longitude)
    })
    map.setZoom(12)
    return
  }

  const bounds = new google.maps.LatLngBounds()

  validLocations.forEach((location) => {
    bounds.extend({
      lat: Number(location.latitude),
      lng: Number(location.longitude)
    })
  })

  map.fitBounds(bounds)
}

function getIconForLocation(location) {
  if (location.category === 'UFO') return UFO_ICON
  if (location.category === 'Folklore') return FOLKLORE_ICON
  if (location.category === 'Cryptid') return CRYPTID_ICON
  if (location.category === 'Unexplained') return UNEXPLAINED_ICON
  return HAUNTED_ICON
}

function buildInfoWindowContent(location) {
  const score = location.mystery_score ? `${location.mystery_score}/10` : 'N/A'
  const stars = renderStars(location.mystery_score)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`

  return `
    <div style="max-width:290px;font-family:Georgia;color:#111;">
      <h3 style="margin:0 0 8px;color:#2d1b69;">
        <a
          href="/location.html?slug=${escapeHtml(location.slug)}"
          target="_blank"
          onclick="window.umami?.track('View Full Mystery', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
          style="color:#2d1b69;text-decoration:none;"
        >
          ${escapeHtml(location.name)}
        </a>
      </h3>

      <p style="margin:0 0 5px;">
        <strong>${escapeHtml(location.category || 'Unknown')}</strong>
        ${location.location_type ? ` • ${escapeHtml(location.location_type)}` : ''}
      </p>

      <p style="margin:0 0 4px;color:#c9a24e;font-size:1rem;letter-spacing:1px;">
        ${stars}
      </p>

      <p style="margin:0 0 8px;">
        Mystery Rating: ${score}
      </p>

      <p style="margin:0 0 12px;">
        ${escapeHtml(location.short_description || '')}
      </p>

      <a
        href="/location.html?slug=${escapeHtml(location.slug)}"
        target="_blank"
        onclick="window.umami?.track('View Full Mystery', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
        style="
          display:block;
          background:#6c5ce7;
          color:white;
          text-decoration:none;
          text-align:center;
          padding:10px;
          border-radius:8px;
          margin-bottom:8px;
          font-weight:bold;
        "
      >
        View Full Mystery
      </a>

      <a
        href="${mapsUrl}"
        target="_blank"
        rel="noopener noreferrer"
        onclick="window.umami?.track('Get Directions', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
        style="
          display:block;
          background:#c9a24e;
          color:white;
          text-decoration:none;
          text-align:center;
          padding:10px;
          border-radius:8px;
          margin-bottom:8px;
          font-weight:bold;
        "
      >
        Directions
      </a>

      ${
        location.affiliate_url
          ? `
            <a
              href="${escapeHtml(location.affiliate_url)}"
              target="_blank"
              rel="noopener noreferrer"
              onclick="window.umami?.track('Stay Nearby', { location: '${escapeAttribute(location.name)}', category: '${escapeAttribute(location.category || 'Unknown')}' })"
              style="
                display:block;
                background:#27ae60;
                color:white;
                text-decoration:none;
                text-align:center;
                padding:10px;
                border-radius:8px;
                font-weight:bold;
              "
            >
              Stay Nearby
            </a>
          `
          : ''
      }
    </div>
  `
}

function setupButtons() {
  const gpsBtn = document.getElementById('gpsBtn')
  if (gpsBtn) gpsBtn.onclick = centerOnUser

  const leyBtn = document.getElementById('leyToggle')
  if (leyBtn) leyBtn.onclick = toggleLeyLines

  const filterToggle = document.getElementById('filterToggle')
  const filtersPanel = document.getElementById('filtersPanel')

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

function setupCategoryFilters() {
  const pills = document.querySelectorAll('.category-pill')

  pills.forEach((pill) => {
    pill.style.cursor = 'pointer'

    pill.addEventListener('click', () => {
      activeCategory = pill.textContent.trim()

      trackEvent('Filter Category', {
        category: activeCategory
      })

      pills.forEach((p) => {
        p.style.background = 'rgba(255,255,255,0.06)'
        p.style.color = '#e8d39a'
      })

      pill.style.background = 'rgba(201,162,78,0.25)'
      pill.style.color = '#ffffff'

      applyFilters()

      const filtersPanel = document.getElementById('filtersPanel')
      if (filtersPanel && window.innerWidth <= 800) {
        filtersPanel.style.display = 'none'
      }
    })
  })
}

function setupSearch() {
  const searchBox = document.getElementById('searchBox')
  if (!searchBox) return

  searchBox.addEventListener('input', () => {
    if (!searchTracked && searchBox.value.trim().length >= 2) {
      trackEvent('Search')
      searchTracked = true
    }

    if (searchBox.value.trim().length === 0) {
      searchTracked = false
    }

    applyFilters()
  })
}

function applyFilters() {
  const searchBox = document.getElementById('searchBox')
  const term = searchBox ? searchBox.value.toLowerCase().trim() : ''

  const filtered = allLocations.filter((location) => {
    const matchesSearch =
      !term ||
      location.name?.toLowerCase().includes(term) ||
      location.city?.toLowerCase().includes(term) ||
      location.region?.toLowerCase().includes(term) ||
      location.country?.toLowerCase().includes(term) ||
      location.category?.toLowerCase().includes(term) ||
      location.location_type?.toLowerCase().includes(term) ||
      location.short_description?.toLowerCase().includes(term)

    const matchesCategory =
      activeCategory === 'All' || location.category === activeCategory

    return matchesSearch && matchesCategory
  })

  renderMarkers(filtered, true)
  updateLocationCount(filtered.length)
}

function updateLocationCount(count) {
  const subtitle = document.querySelector('.subtitle')
  if (subtitle) {
    subtitle.textContent = `${count} mysteries mapped • Mapping the Unexplained`
  }
}

function setupMobileViewTabs() {
  const mapViewBtn = document.getElementById('mapViewBtn')
  const listViewBtn = document.getElementById('listViewBtn')

  if (!mapViewBtn || !listViewBtn) return

  document.body.classList.add('map-view')

  mapViewBtn.onclick = () => {
    trackEvent('Mobile Map View')
    showMapView()
  }

  listViewBtn.onclick = () => {
    trackEvent('Mobile List View')
    showListView()
  }
}

function showMapView() {
  const mapViewBtn = document.getElementById('mapViewBtn')
  const listViewBtn = document.getElementById('listViewBtn')

  document.body.classList.remove('list-view')
  document.body.classList.add('map-view')

  if (mapViewBtn) mapViewBtn.classList.add('active')
  if (listViewBtn) listViewBtn.classList.remove('active')

  if (map) {
    setTimeout(() => {
      google.maps.event.trigger(map, 'resize')
    }, 100)
  }
}

function showListView() {
  const mapViewBtn = document.getElementById('mapViewBtn')
  const listViewBtn = document.getElementById('listViewBtn')

  document.body.classList.remove('map-view')
  document.body.classList.add('list-view')

  if (listViewBtn) listViewBtn.classList.add('active')
  if (mapViewBtn) mapViewBtn.classList.remove('active')
}

function setupSubmitMystery() {
  const submitToggle = document.getElementById('submitToggle')
  const submitPanel = document.getElementById('submitPanel')
  const submitBtn = document.getElementById('submitMysteryBtn')
  const closeSubmitPanel = document.getElementById('closeSubmitPanel')

  if (!submitToggle || !submitPanel || !submitBtn) return

  submitToggle.onclick = () => {
    trackEvent('Open Submit Form')

    submitPanel.style.display =
      submitPanel.style.display === 'none' || submitPanel.style.display === ''
        ? 'block'
        : 'none'
  }

  if (closeSubmitPanel) {
    closeSubmitPanel.onclick = () => {
      trackEvent('Close Submit Form')
      submitPanel.style.display = 'none'
    }
  }

  submitBtn.onclick = async () => {
    const name = document.getElementById('submitName').value.trim()
    const city = document.getElementById('submitCity').value.trim()
    const region = document.getElementById('submitRegion').value.trim()
    const category = document.getElementById('submitCategory').value
    const latitude = Number(document.getElementById('submitLat').value)
    const longitude = Number(document.getElementById('submitLng').value)
    const story = document.getElementById('submitStory').value.trim()

    if (!name || !latitude || !longitude || !story) {
      trackEvent('Submit Form Validation Error')
      alert('Please add a name, latitude, longitude and short story.')
      return
    }

    const { error } = await supabase.from('locations').insert({
      name,
      slug: `${createSlug(name)}-${Date.now()}`,
      category,
      location_type: 'Unknown',
      country: 'Australia',
      region,
      city,
      latitude,
      longitude,
      short_description: story,
      mystery_score: null,
      tags: [category, 'User Submitted'],
      is_featured: false,
      status: 'Needs Review'
    })

    if (error) {
      console.error(error)
      trackEvent('Mystery Submission Failed')
      alert('Submission failed.')
      return
    }

    trackEvent('Mystery Submitted', {
      category,
      region: region || 'Unknown'
    })

    alert('Thanks. Your mystery has been submitted for review.')
    clearSubmitForm()
    submitPanel.style.display = 'none'
  }
}

function clearSubmitForm() {
  ;['submitName','submitCity','submitRegion','submitLat','submitLng','submitStory'].forEach((id) => {
    const field = document.getElementById(id)
    if (field) field.value = ''
  })
}

function toggleLeyLines() {
  leyVisible = !leyVisible

  trackEvent('Toggle Ley Lines', {
    visible: leyVisible ? 'true' : 'false'
  })

  const leyBtn = document.getElementById('leyToggle')
  if (leyBtn) leyBtn.textContent = leyVisible ? '✕' : '⚡'

  if (leyVisible) {
    leyLines = getLeyLinePaths().map((line) => {
      const polyline = new google.maps.Polyline({
        path: line.path,
        geodesic: true,
        strokeColor: line.color,
        strokeOpacity: 0.8,
        strokeWeight: 2
      })

      polyline.setMap(map)
      return polyline
    })
  } else {
    leyLines.forEach((line) => line.setMap(null))
    leyLines = []
  }
}

function getLeyLinePaths() {
  return [
    { path: [{ lat: 51.1789, lng: -1.8262 }, { lat: 29.9792, lng: 31.1342 }], color: '#ff6b6b' },
    { path: [{ lat: -25.3444, lng: 131.0369 }, { lat: -13.1631, lng: -72.545 }], color: '#4ecdc4' },
    { path: [{ lat: 41.3095, lng: -122.3121 }, { lat: 25, lng: -71 }], color: '#45b7d1' },
    { path: [{ lat: -33.8568, lng: 151.2153 }, { lat: -37.8136, lng: 144.9631 }], color: '#a29bfe' }
  ]
}

function centerOnUser() {
  trackEvent('Near Me Click')

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.')
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      trackEvent('Near Me Success')

      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      showMapView()
      map.setCenter(userLocation)
      map.setZoom(10)

      if (userMarker) userMarker.setMap(null)

      userMarker = new google.maps.Marker({
        position: userLocation,
        map,
        title: 'Your Location',
        icon: {
          url: USER_LOCATION_ICON,
          scaledSize: new google.maps.Size(40, 40)
        }
      })
    },
    () => {
      trackEvent('Near Me Failed')
      alert('Unable to get your location.')
    }
  )
}

function createSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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
