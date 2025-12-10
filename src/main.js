const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  document.body.innerHTML = '<div style="background:#000;color:#ff6b6b;text-align:center;padding:4rem;font-family:Georgia;"><h1>API Key Missing</h1><p>Add <strong>VITE_GOOGLE_MAPS_API_KEY</strong> in Vercel Environment Variables</p></div>';
} else {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&callback=initMap&libraries=geometry`;
  script.async = true;
  document.head.appendChild(script);
}

// Pre-encoded static SVG icons (no dynamic template literals = no esbuild errors)
const GHOST_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23ff4545' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E";
const PURPLE_GHOST_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%239458ff' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E";
const GRAVE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%23999999' stroke='%23000' stroke-width='3'/%3E%3Ctext x='20' y='25' font-size='16' text-anchor='middle' fill='%23fff'%3E%F0%9F%AA%A6%3C/text%3E%3C/svg%3E";

window.initMap = function () {
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 3,
    center: { lat: 20, lng: 0 },
    styles: [
      {featureType: "all", elementType: "geometry", stylers: [{color: "#1a1a1a"}]},
      {featureType: "all", elementType: "labels.text.fill", stylers: [{color: "#746855"}]},
      {featureType: "road", elementType: "geometry", stylers: [{color: "#38414e"}]},
      {featureType: "water", elementType: "geometry", stylers: [{color: "#17263c"}]}
    ]
  });

  let leyLines = [];
  let leyVisible = false;

  const leyLinePaths = [
    {path:[{lat:51.1789,lng:-1.8262},{lat:29.9792,lng:31.1342}],color:"#ff6b6b"},
    {path:[{lat:-25.3444,lng:131.0369},{lat:-13.1631,lng:-72.5450}],color:"#4ecdc4"},
    {path:[{lat:41.3095,lng:-122.3121},{lat:25,lng:-71}],color:"#45b7d1"},
    {path:[{lat:50.7306,lng:-1.4994},{lat:31.7683,lng:35.2137}],color:"#f9ca24"},
    {path:[{lat:35.6762,lng:139.6503},{lat:13.4125,lng:103.8669}],color:"#f0932b"},
    {path:[{lat:19.4326,lng:-99.1332},{lat:-27.1127,lng:-109.3497}],color:"#eb4d4b"},
    {path:[{lat:37.9838,lng:23.7275},{lat:27.1751,lng:78.0421}],color:"#6c5ce7"},
    {path:[{lat:-33.8568,lng:151.2153},{lat:-37.8136,lng:144.9631}],color:"#a29bfe"},
    {path:[{lat:40.7128,lng:-74.0060},{lat:48.8566,lng:2.3522}],color:"#fd79a8"},
    {path:[{lat:-33.4489,lng:-70.6693},{lat:-25.2637,lng:-57.5759}],color:"#55efc4"}
  ];

  const haunts = [
    ["New Orleans Ghost Tour",29.9584,-90.0651,"Ghost","French Quarter voodoo tour","https://www.viator.com/tours/New-Orleans/New-Orleans-Ghost-Voodoo-and-Vampire-Tour/d675-3780GT3"],
    // ... (all other haunts from previous versions)
    ["Barwon Heads Cemetery",-38.2833,144.4833,"Grave","Seaside graves from 1870s"]
  ];

  haunts.forEach(h => {
    const isCemetery = h[5] === "Grave";
    const isUS = h[1] > 20;
    const baseIcon = isCemetery ? GRAVE_ICON : (isUS ? GHOST_ICON : PURPLE_GHOST_ICON);

    const marker = new google.maps.Marker({
      position: {lat: h[1], lng: h[2]},
      map,
      title: h[0],
      icon: { url: baseIcon, scaledSize: new google.maps.Size(40,40) }
    });

    // ... info window code (same as before)

    // Store for ley line color change
    h.marker = marker;
    h.defaultIcon = baseIcon;
  });

  // Ley lines toggle and updateColors functions (same as before, but use pre-defined colors or static URLs for ley-aligned pins)

  // ... rest of ley lines code
};

document.getElementById("gpsBtn").onclick = centerOnUser;
