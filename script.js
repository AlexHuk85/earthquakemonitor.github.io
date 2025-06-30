// Global variables
let earthquakeChart;
let earthquakeMap;
let markers = [];
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    fetchEarthquakeData();
});

// Set up event listeners
function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', fetchEarthquakeData);
    document.getElementById('timeRange').addEventListener('change', fetchEarthquakeData);
    document.getElementById('minMagnitude').addEventListener('change', fetchEarthquakeData);
    
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
}

// Initialize Leaflet map
function initializeMap() {
    earthquakeMap = L.map('earthquakeMap').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(earthquakeMap);
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const autoRefreshBtn = document.getElementById('autoRefreshBtn');
    isAutoRefreshEnabled = !isAutoRefreshEnabled;
    
    if (isAutoRefreshEnabled) {
        autoRefreshBtn.textContent = 'Disable Auto-Refresh';
        autoRefreshBtn.classList.add('active');
        autoRefreshInterval = setInterval(fetchEarthquakeData, 10000); // 10 seconds
        updateRefreshStatus('Auto-refresh enabled (every 10 seconds)');
    } else {
        autoRefreshBtn.textContent = 'Enable Auto-Refresh (10s)';
        autoRefreshBtn.classList.remove('active');
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        updateRefreshStatus('Auto-refresh disabled');
    }
}

// Update refresh status
function updateRefreshStatus(message) {
    const statusElement = document.getElementById('refreshStatus');
    statusElement.textContent = message;
    
    // Add refreshing animation
    statusElement.classList.add('refreshing');
    setTimeout(() => {
        statusElement.classList.remove('refreshing');
    }, 1000);
}

// Fetch earthquake data from USGS API
function fetchEarthquakeData() {
    updateRefreshStatus('Refreshing data...');
    
    const timeRange = document.getElementById('timeRange').value;
    const minMagnitude = document.getElementById('minMagnitude').value;
    
    let url;
    switch(timeRange) {
        case 'hour':
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`;
            break;
        case 'day':
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_day.geojson`;
            break;
        case 'week':
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_week.geojson`;
            break;
        case 'month':
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_month.geojson`;
            break;
        default:
            url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMagnitude}_day.geojson`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            processEarthquakeData(data.features);
            updateRefreshStatus(`Last updated: ${new Date().toLocaleTimeString()}`);
        })
        .catch(error => {
            console.error('Error fetching earthquake data:', error);
            updateRefreshStatus('Error fetching data. Try again.');
        });
}

// Process earthquake data and update UI
function processEarthquakeData(earthquakes) {
    // Clear previous markers
    clearMapMarkers();
    
    // Sort by time (newest first)
    earthquakes.sort((a, b) => new Date(b.properties.time) - new Date(a.properties.time));
    
    // Prepare data for chart
    const chartData = prepareChartData(earthquakes);
    updateChart(chartData);
    
    // Add earthquakes to map
    addEarthquakesToMap(earthquakes);
    
    // Update table
    updateEarthquakeTable(earthquakes);
}

// Prepare data for the chart
function prepareChartData(earthquakes) {
    const magnitudeData = [];
    const depthData = [];
    const labels = [];
    const colors = [];
    
    // Get the most recent 20 earthquakes for the chart
    const recentEarthquakes = earthquakes.slice(0, 20).reverse();
    
    recentEarthquakes.forEach(quake => {
        const time = new Date(quake.properties.time);
        labels.push(time.toLocaleTimeString());
        magnitudeData.push(quake.properties.mag);
        depthData.push(quake.geometry.coordinates[2]);
        
        // Set color based on magnitude
        if (quake.properties.mag >= 6) {
            colors.push('rgba(255, 0, 0, 0.7)');
        } else if (quake.properties.mag >= 4.5) {
            colors.push('rgba(255, 165, 0, 0.7)');
        } else {
            colors.push('rgba(0, 123, 255, 0.7)');
        }
    });
    
    return {
        labels,
        magnitudeData,
        depthData,
        colors
    };
}

// Update or create the chart
function updateChart(chartData) {
    const ctx = document.getElementById('earthquakeChart').getContext('2d');
    
    if (earthquakeChart) {
        earthquakeChart.destroy();
    }
    
    earthquakeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Magnitude',
                    data: chartData.magnitudeData,
                    backgroundColor: chartData.colors,
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Depth (km)',
                    data: chartData.depthData,
                    backgroundColor: 'rgba(100, 100, 100, 0.2)',
                    borderColor: 'rgba(100, 100, 100, 1)',
                    borderWidth: 1,
                    type: 'line',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Depth (km)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            return `Depth: ${chartData.depthData[index]} km`;
                        }
                    }
                }
            }
        }
    });
}

// Add earthquake markers to the map
function addEarthquakesToMap(earthquakes) {
    earthquakes.forEach(quake => {
        const coords = quake.geometry.coordinates;
        const lat = coords[1];
        const lng = coords[0];
        const depth = coords[2];
        const magnitude = quake.properties.mag;
        const place = quake.properties.place;
        const time = new Date(quake.properties.time).toLocaleString();
        
        // Determine marker size and color based on magnitude
        const markerSize = magnitude * 3;
        let markerColor;
        
        if (magnitude >= 6) {
            markerColor = '#ff0000';
        } else if (magnitude >= 4.5) {
            markerColor = '#ffa500';
        } else {
            markerColor = '#007bff';
        }
        
        // Create a circle marker
        const marker = L.circleMarker([lat, lng], {
            radius: markerSize,
            fillColor: markerColor,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(earthquakeMap);
        
        // Add popup with earthquake info
        marker.bindPopup(`
            <strong>Location:</strong> ${place}<br>
            <strong>Magnitude:</strong> ${magnitude}<br>
            <strong>Depth:</strong> ${depth} km<br>
            <strong>Time:</strong> ${time}
        `);
        
        markers.push(marker);
    });
    
    // Fit map to show all markers if there are any
    if (markers.length > 0) {
        const markerGroup = new L.featureGroup(markers);
        earthquakeMap.fitBounds(markerGroup.getBounds());
    }
}

// Clear all markers from the map
function clearMapMarkers() {
    markers.forEach(marker => {
        earthquakeMap.removeLayer(marker);
    });
    markers = [];
}

// Update the earthquake table
function updateEarthquakeTable(earthquakes) {
    const tableBody = document.getElementById('earthquakeTableBody');
    tableBody.innerHTML = '';
    
    earthquakes.slice(0, 50).forEach(quake => {
        const row = document.createElement('tr');
        
        const placeCell = document.createElement('td');
        placeCell.textContent = quake.properties.place;
        
        const magCell = document.createElement('td');
        magCell.textContent = quake.properties.mag;
        if (quake.properties.mag >= 6) {
            magCell.style.color = 'red';
            magCell.style.fontWeight = 'bold';
        } else if (quake.properties.mag >= 4.5) {
            magCell.style.color = 'orange';
        }
        
        const depthCell = document.createElement('td');
        depthCell.textContent = `${quake.geometry.coordinates[2]} km`;
        
        const timeCell = document.createElement('td');
        timeCell.textContent = new Date(quake.properties.time).toLocaleString();
        
        row.appendChild(placeCell);
        row.appendChild(magCell);
        row.appendChild(depthCell);
        row.appendChild(timeCell);
        
        tableBody.appendChild(row);
    });
}
