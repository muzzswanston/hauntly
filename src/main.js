import { supabase } from '../lib/supabaseClient'

let map;
let allLocations = [];
let filteredLocations = [];
let markers = [];
let infoWindow;
let selectedCategory = "All";
let leyLinesVisible = false;
let leyLinePolylines = [];
let userMarker = null;

const DEFAULT_CENTER = { lat: -25.2744, lng: 133.7751 };
const DEFAULT_ZOOM = 4;

const CATEGORY_ICONS = {
  Haunted: "👻",
  UFO: "🛸",
  Folklore: "📜",
  Cryptid: "🐾",
  Unexplained: "❓",
};

window.initMap = async function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#1b1b1f" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1f" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#c9a24e" }] },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#101827" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#2b2b31" }],
      },
    ],
  });

  infoWindow = new google.maps.InfoWindow();

  setupEventListeners();
  setupLeyLines();
  await loadLocations();
};

async function loadLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .in("status", ["Published", "Researching"])
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading locations:", error);
    return;
  }

  allLocations = data || [];
  filteredLocations = [...allLocations];

  renderLocations();
  renderResults();
  updateSubtitle();
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  const categoryButtons = document.querySelectorAll("[data-category]");
  const gpsButton = document.getElementById("gpsButton");
  const leyLinesButton = document.getElementById("leyLinesButton");
  const mapViewBtn = document.getElementById("mapViewBtn");
  const listViewBtn = document.getElementById("listViewBtn");
  const submitForm = document.getElementById("submitMysteryForm");

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;

      categoryButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      applyFilters();
    });
  });

  if (gpsButton) {
    gpsButton.addEventListener("click", centerOnUser);
  }

  if (leyLinesButton) {
    leyLinesButton.addEventListener("click", toggleLeyLines);
  }

  if (mapViewBtn && listViewBtn) {
    mapViewBtn.addEventListener("click", () => setMobileView("map"));
    listViewBtn.addEventListener("click", () => setMobileView("list"));
  }

  if (submitForm) {
    submitForm.addEventListener("submit", handleSubmitMystery);
  }
}

function applyFilters() {
  const searchInput = document.getElementById("searchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  filteredLocations = allLocations.filter((location) => {
    const matchesCategory =
      selectedCategory === "All" || location.category === selectedCategory;

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
      location.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !query || searchableText.includes(query);

    return matchesCategory && matchesSearch;
  });

  renderLocations();
  renderResults();
  updateSubtitle();
}

function renderLocations() {
  clearMarkers();

  filteredLocations.forEach((location) => {
    if (!location.latitude || !location.longitude) return;

    const marker = new google.maps.Marker({
      position: {
        lat: Number(location.latitude),
        lng: Number(location.longitude),
      },
      map,
      title: location.name,
      icon: createMarkerIcon(location.category),
    });

    marker.addListener("click", () => openLocationInfo(location, marker));

    markers.push(marker);
  });

  fitMapToMarkers();
}

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

function createMarkerIcon(category) {
  const emoji = CATEGORY_ICONS[category] || "❓";

  const svg = `
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="18" fill="#111318" stroke="#c9a24e" stroke-width="3"/>
      <text x="22" y="28" text-anchor="middle" font-size="20">${emoji}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  };
}

function openLocationInfo(location, marker) {
  const imageHtml = location.image_url
    ? `
      <img
        class="info-image"
        src="${escapeHtml(location.image_url)}"
        alt="${escapeHtml(location.image_alt_text || location.name)}"
      />
    `
    : "";

  const imageCreditHtml =
    location.image_credit || location.image_license || location.image_source
      ? `
        <div class="image-credit">
          ${location.image_credit ? `Credit: ${escapeHtml(location.image_credit)}` : ""}
          ${location.image_license ? ` • ${escapeHtml(location.image_license)}` : ""}
          ${
            location.image_source
              ? ` • <a href="${escapeHtml(location.image_source)}" target="_blank" rel="noopener">Image source</a>`
              : ""
          }
        </div>
      `
      : "";

  const sourceHtml = location.source_url
    ? `<a href="${escapeHtml(location.source_url)}" target="_blank" rel="noopener">View source</a>`
    : "";

  const affiliateHtml = location.affiliate_url
    ? `<a href="${escapeHtml(location.affiliate_url)}" target="_blank" rel="noopener">Book or explore nearby</a>`
    : "";

  const infoHtml = `
    <div class="info-window">
      ${imageHtml}
      ${imageCreditHtml}

      <h3>${escapeHtml(location.name)}</h3>

      <div class="badge-row">
        ${getStatusBadge(location)}
        ${getEvidenceBadge(location)}
      </div>

      <p class="info-meta">
        <strong>${escapeHtml(location.category || "Unknown")}</strong>
        ${location.location_type ? ` • ${escapeHtml(location.location_type)}` : ""}
      </p>

      ${
        location.short_description
          ? `<p>${escapeHtml(location.short_description)}</p>`
          : ""
      }

      <p><strong>Mystery Score:</strong> ${location.mystery_score || "?"}/10</p>

      ${
        location.why_it_matters
          ? `<p><strong>Why it matters:</strong> ${escapeHtml(location.why_it_matters)}</p>`
          : ""
      }

      ${
        location.access_notes
          ? `<p><strong>Access:</strong> ${escapeHtml(location.access_notes)}</p>`
          : ""
      }

      ${
        location.visitor_info
          ? `<p><strong>Visitor info:</strong> ${escapeHtml(location.visitor_info)}</p>`
          : ""
      }

      <div class="info-links">
        ${sourceHtml}
        ${affiliateHtml}
      </div>
    </div>
  `;

  infoWindow.setContent(infoHtml);
  infoWindow.open(map, marker);
}

function renderResults() {
  const resultsList = document.getElementById("resultsList");
  if (!resultsList) return;

  resultsList.innerHTML = "";

  if (filteredLocations.length === 0) {
    resultsList.innerHTML = `
      <div class="empty-state">
        No mysteries found. Try another search or category.
      </div>
    `;
    return;
  }

  filteredLocations.forEach((location) => {
    const card = document.createElement("button");
    card.className = "result-card";
    card.type = "button";

    card.innerHTML = `
      <div class="result-header">
        <strong>${escapeHtml(location.name)}</strong>
      </div>

      <div class="badge-row">
        ${getStatusBadge(location)}
        ${getEvidenceBadge(location)}
      </div>

      <div class="result-meta">
        ${escapeHtml(location.category || "Unknown")}
        ${location.city ? ` • ${escapeHtml(location.city)}` : ""}
        ${location.region ? `, ${escapeHtml(location.region)}` : ""}
      </div>

      ${
        location.short_description
          ? `<p>${escapeHtml(location.short_description)}</p>`
          : ""
      }
    `;

    card.addEventListener("click", () => {
      const marker = markers.find(
        (m) =>
          Number(m.getPosition().lat()).toFixed(6) ===
            Number(location.latitude).toFixed(6) &&
          Number(m.getPosition().lng()).toFixed(6) ===
            Number(location.longitude).toFixed(6)
      );

      if (location.latitude && location.longitude) {
        map.setCenter({
          lat: Number(location.latitude),
          lng: Number(location.longitude),
        });
        map.setZoom(12);
      }

      if (marker) {
        openLocationInfo(location, marker);
      }

      setMobileView("map");
    });

    resultsList.appendChild(card);
  });
}

function getStatusBadge(location) {
  if (location.status === "Researching") {
    return `<span class="badge status-researching">Researching</span>`;
  }

  return "";
}

function getEvidenceBadge(location) {
  const level = location.evidence_level;

  if (!level) return "";

  const badgeClasses = {
    Verified: "evidence-verified",
    Documented: "evidence-documented",
    Folklore: "evidence-folklore",
    Researching: "evidence-researching",
    "User Submitted": "evidence-user-submitted",
  };

  const className = badgeClasses[level] || "evidence-unknown";

  return `<span class="badge ${className}">${escapeHtml(level)}</span>`;
}

function fitMapToMarkers() {
  if (markers.length === 0) {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);
    return;
  }

  if (markers.length === 1) {
    map.setCenter(markers[0].getPosition());
    map.setZoom(12);
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  markers.forEach((marker) => {
    bounds.extend(marker.getPosition());
  });

  map.fitBounds(bounds);
}

function updateSubtitle() {
  const subtitle = document.getElementById("subtitle");
  if (!subtitle) return;

  subtitle.textContent = `${filteredLocations.length} mysteries mapped • Mapping the Unexplained`;
}

function centerOnUser() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      map.setCenter(userPosition);
      map.setZoom(12);

      if (userMarker) {
        userMarker.setMap(null);
      }

      userMarker = new google.maps.Marker({
        position: userPosition,
        map,
        title: "Your location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4fc3f7",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    },
    () => {
      alert("Unable to access your location.");
    }
  );
}

function setupLeyLines() {
  const leyLinePaths = [
    [
      { lat: 51.1789, lng: -1.8262 },
      { lat: 29.9792, lng: 31.1342 },
    ],
    [
      { lat: -25.3444, lng: 131.0369 },
      { lat: -13.1631, lng: -72.545 },
    ],
    [
      { lat: 41.4099, lng: -122.1944 },
      { lat: 25.0000, lng: -71.0000 },
    ],
    [
      { lat: -33.8688, lng: 151.2093 },
      { lat: -37.8136, lng: 144.9631 },
    ],
  ];

  leyLinePolylines = leyLinePaths.map((path) => {
    return new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#c9a24e",
      strokeOpacity: 0.7,
      strokeWeight: 2,
    });
  });
}

function toggleLeyLines() {
  leyLinesVisible = !leyLinesVisible;

  leyLinePolylines.forEach((line) => {
    line.setMap(leyLinesVisible ? map : null);
  });

  const leyLinesButton = document.getElementById("leyLinesButton");
  if (leyLinesButton) {
    leyLinesButton.textContent = leyLinesVisible
      ? "Hide Ley Lines"
      : "Show Ley Lines";
  }
}

function setMobileView(view) {
  const app = document.body;
  const mapViewBtn = document.getElementById("mapViewBtn");
  const listViewBtn = document.getElementById("listViewBtn");

  if (view === "list") {
    app.classList.add("show-list");
    app.classList.remove("show-map");
    mapViewBtn?.classList.remove("active");
    listViewBtn?.classList.add("active");
  } else {
    app.classList.add("show-map");
    app.classList.remove("show-list");
    listViewBtn?.classList.remove("active");
    mapViewBtn?.classList.add("active");

    setTimeout(() => {
      google.maps.event.trigger(map, "resize");
      fitMapToMarkers();
    }, 100);
  }
}

async function handleSubmitMystery(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "Unexplained").trim();
  const description = String(formData.get("description") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const region = String(formData.get("region") || "").trim();

  if (!name || !description) {
    alert("Please add a name and description.");
    return;
  }

  const submission = {
    name,
    slug: `${createSlug(name)}-${Date.now()}`,
    category,
    location_type: "Unknown",
    country: "Australia",
    region,
    city,
    short_description: description,
    mystery_score: 5,
    tags: [category, "User Submitted"],
    is_featured: false,
    status: "Needs Review",
    evidence_level: "User Submitted",
  };

  const { error } = await supabase.from("locations").insert(submission);

  if (error) {
    console.error("Error submitting mystery:", error);
    alert("Something went wrong. Please try again.");
    return;
  }

  form.reset();
  alert("Mystery submitted for review.");
}

function createSlug(value) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
