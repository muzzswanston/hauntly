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

const GHOST_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23ff4545' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E"

const UFO_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%239458ff' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%9B%B8%3C/text%3E%3C/svg%3E"

const GRAVE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23999999' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%AA%A6%3C/text%3E%3C/svg%3E"

window.initMap = async function () {
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 3,
    center: { lat: -25.2744, lng: 133.7751 },
    styles: [
      { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
      { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
    ]
  })

  let leyLines = []
  let leyVisible = false

  const leyLinePaths = [
    { path: [{ lat: 51.1789, lng: -1.8262 }, { lat: 29.9792, lng: 31.1342 }], color: '#ff6b6b' },
    { path: [{ lat: -25.3444, lng: 131.0369 }, { lat: -13.1631, lng: -72.5450 }], color: '#4ecdc4' },
    { path: [{ lat: 41.3095, lng: -122.3121 }, { lat: 25, lng: -71 }], color: '#45b7d1' },
    { path: [{ lat: 50.7306, lng: -1.4994 }, { lat: 31.7683, lng: 35.2137 }], color: '#f9ca24' },
    { path: [{ lat: 35.6762, lng: 139.6503 }, { lat: 13.4125, lng: 103.8669 }], color: '#f0932b' },
    { path: [{ lat: 19.4326, lng: -99.1332 }, { lat: -27.1127, lng: -109.3497 }], color: '#eb4d4b' },
    { path: [{ lat: 37.9838, lng: 23.7275 }, { lat: 27.1751, lng: 78.0421 }], color: '#6c5ce7' },
    { path: [{ lat: -33.8568, lng: 151.2153 }, { lat: -37.8136, lng: 144.9631 }], color: '#a29bfe' },
    { path: [{ lat: 40.7128, lng: -74.0060 }, { lat: 48.8566, lng: 2.3522 }], color: '#fd79a8' },
    { path: [{ lat: -33.4489, lng: -70.6693 }, { lat: -25.2637, lng: -57.5759 }], color: '#55efc4' }
  ]

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'Published')

  if (error) {
    console.error('Supabase error:', error)
    return
  }

  console.log('Locations from Supabase:', locations)

  locations.forEach((location) => {
    const iconUrl = getIconForLocation(location)

    const marker = new google.maps.Marker({
      position: {
        lat: Number(location.latitude),
        lng: Number(location.longitude)
      },
      map,
      title: location.name,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(40, 40)
      }
    })

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="max-width:260px;font-family:Georgia;color:#111;">
          <h3 style="margin:0 0 8px;">${location.name}</h3>
          <p style="margin:0 0 6px;"><strong>Category:</strong> ${location.category}</p>
          <p style="margin:0 0 6px;"><strong>Type:</strong> ${location.location_type}</p>
          <p style="margin:0 0 6px;"><strong>Score:</strong> ${location.mystery_score || 'N/A'}/10</p>
          <p style="margin:0 0 8px;">${location.short_description || ''}</p>
          ${
            location.source_url
              ? `<a href="${location.source_url}" target="_blank" rel="noopener noreferrer">Source</a>`
              : ''
          }
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(map, marker)
    })
  })

  function getIconForLocation(location) {
    if (location.location_type === 'Cemetery') return GRAVE_ICON
    if (location.category === 'UFO') return UFO_ICON
    return GHOST_ICON
  }

  function toggleLeyLines() {
    leyVisible = !leyVisible

    if (leyVisible) {
      leyLines = leyLinePaths.map((line) => {
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

        new google.maps.Marker({
          position: userLocation,
          map,
          title: 'Your Location'
        })
      },
      () => {
        alert('Unable to get your location.')
      }
    )
  }

  const gpsBtn = document.getElementById('gpsBtn')
  if (gpsBtn) {
    gpsBtn.onclick = centerOnUser
  }

  const leyBtn = document.getElementById('leyBtn')
  if (leyBtn) {
    leyBtn.onclick = toggleLeyLines
  }
}
