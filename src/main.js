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

window.initMap = async function () {
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

  console.log('Locations from Supabase:', allLocations)

  renderMarkers(allLocations)
  updateLocationCount(allLocations.length)
}

function renderMarkers(locations) {
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
      infoWindow.open(map, marker)
    })

    allMarkers.push(marker)
  })
}

function clearMarkers() {
  allMarkers.forEach((marker) => marker.setMap(null))
  allMarkers = []
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

  return `
    <div style="max-width:280px;font-family:Georgia;color:#111;">
      <h3 style="margin:0 0 8px;">${escapeHtml(location.name)}</h3>
      <p style="margin:0 0 6px;"><strong>Category:</strong> ${escapeHtml(location.category || 'Unknown')}</p>
      <p style="margin:0 0 6px;"><strong>Type:</strong> ${escapeHtml(location.location_type || 'Unknown')}</p>
      <p style="margin:0 0 6px;"><strong>Mystery Rating:</strong> ${score}</p>
      <p style="margin:0 0 8px;">${escapeHtml(location.short_description || '')}</p>
      ${
        location.access_notes
          ? `<p style="margin:0 0 6px;"><strong>Access:</strong> ${escapeHtml(location.access_notes)}</p>`
          : ''
      }
      ${
        location.visitor_info
          ? `<p style="margin:0 0 6px;"><strong>Visitor info:</strong> ${escapeHtml(location.visitor_info)}</p>`
          : ''
      }
      ${
        location.affiliate_url
          ? `<a href="${escapeHtml(location.affiliate_url)}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;">Book or explore nearby</a>`
          : ''
      }
      ${
        location.source_url
          ? `<a href="${escapeHtml(location.source_url)}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;">View source</a>`
          : ''
      }
    </div>
  `
}

function setupButtons() {
  const gpsBtn = document.getElementById('gpsBtn')
  if (gpsBtn) {
    gpsBtn.onclick = centerOnUser
  }

  const leyBtn = document.getElementById('leyToggle')
  if (leyBtn) {
    leyBtn.onclick = toggleLeyLines
  }
}

function setupCategoryFilters() {
  const pills = document.querySelectorAll('.category-pill')

  pills.forEach((pill) => {
    pill.style.cursor = 'pointer'

    pill.addEventListener('click', () => {
      activeCategory = pill.textContent.trim()

      pills.forEach((p) => {
        p.style.background = 'rgba(255,255,255,0.06)'
        p.style.color = '#e8d39a'
      })

      pill.style.background = 'rgba(201,162,78,0.25)'
      pill.style.color = '#ffffff'

      applyFilters()
    })
  })
}

function setupSearch() {
  const searchBox = document.getElementById('searchBox')
  if (!searchBox) return

  searchBox.addEventListener('input', applyFilters)
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

  renderMarkers(filtered)
  updateLocationCount(filtered.length)
}

function updateLocationCount(count) {
  const subtitle = document.querySelector('.subtitle')
  if (subtitle) {
    subtitle.textContent = `${count} mysteries mapped • Mapping the Unexplained`
  }
}

function setupSubmitMystery() {
  const submitToggle = document.getElementById('submitToggle')
  const submitPanel = document.getElementById('submitPanel')
  const submitBtn = document.getElementById('submitMysteryBtn')

  if (!submitToggle || !submitPanel || !submitBtn) return

  submitToggle.onclick = () => {
    submitPanel.style.display =
      submitPanel.style.display === 'none' || submitPanel.style.display === ''
        ? 'block'
        : 'none'
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
      alert('Please add a name, latitude, longitude and short story.')
      return
    }

    const slug = createSlug(name)

    const { error } = await supabase.from('locations').insert({
      name,
      slug: `${slug}-${Date.now()}`,
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
      alert('Submission failed.')
      return
    }

    alert('Thanks. Your mystery has been submitted for review.')
    clearSubmitForm()
    submitPanel.style.display = 'none'
  }
}

function clearSubmitForm() {
  const fields = [
    'submitName',
    'submitCity',
    'submitRegion',
    'submitLat',
    'submitLng',
    'submitStory'
  ]

  fields.forEach((id) => {
    const field = document.getElementById(id)
    if (field) field.value = ''
  })
}

function toggleLeyLines() {
  leyVisible = !leyVisible

  const leyBtn = document.getElementById('leyToggle')
  if (leyBtn) {
    leyBtn.textContent = leyVisible ? 'Hide Ley Lines' : '⚡ Ley Lines'
  }

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
    { path: [{ lat: 50.7306, lng: -1.4994 }, { lat: 31.7683, lng: 35.2137 }], color: '#f9ca24' },
    { path: [{ lat: 35.6762, lng: 139.6503 }, { lat: 13.4125, lng: 103.8669 }], color: '#f0932b' },
    { path: [{ lat: 19.4326, lng: -99.1332 }, { lat: -27.1127, lng: -109.3497 }], color: '#eb4d4b' },
    { path: [{ lat: 37.9838, lng: 23.7275 }, { lat: 27.1751, lng: 78.0421 }], color: '#6c5ce7' },
    { path: [{ lat: -33.8568, lng: 151.2153 }, { lat: -37.8136, lng: 144.9631 }], color: '#a29bfe' },
    { path: [{ lat: 40.7128, lng: -74.006 }, { lat: 48.8566, lng: 2.3522 }], color: '#fd79a8' },
    { path: [{ lat: -33.4489, lng: -70.6693 }, { lat: -25.2637, lng: -57.5759 }], color: '#55efc4' }
  ]
}

function centerOnUser() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.')
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      map.setCenter(userLocation)
      map.setZoom(10)

      if (userMarker) {
        userMarker.setMap(null)
      }

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
      alert('Unable to get your location.')
    }
  )
}

function createSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
