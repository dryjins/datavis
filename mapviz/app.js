// Main map drawing function with Canvas and virtual DOM approach
// Author: D3.js visualization class

// Canvas setup with device pixel ratio handling for crisp rendering
const width = 960;
const height = 500;
const canvas = document.getElementById("map-canvas");
const context = canvas.getContext("2d");

// Handle high-DPI displays for crisp rendering
const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = width * devicePixelRatio;
canvas.height = height * devicePixelRatio;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
context.scale(devicePixelRatio, devicePixelRatio);

// Create tooltip element
const tooltip = d3.select("#tooltip");

// Create virtual DOM for data binding and interaction
const detachedContainer = document.createElement("custom");
const dataContainer = d3.select(detachedContainer);

// Map state and controls
let mapTransform = d3.zoomIdentity;
let worldData = null;
const countryColors = {};
const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 5]); // Will be adjusted once data is loaded

// Set up projection and path generator
const projection = d3
  .geoNaturalEarth1()
  .scale(153)
  .translate([width / 2, height / 2]);

// Create path generator with Canvas context
const path = d3.geoPath().projection(projection).context(context);

// Add clipping path support
function addClipPath() {
  // Set up clipping to prevent drawing outside desired area
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
}

// Load world data and initialize map
d3.json("https://unpkg.com/world-atlas@2/countries-110m.json")
  .then((data) => {
    // Convert TopoJSON to GeoJSON
    worldData = topojson.feature(data, data.objects.countries);

    // Create initial random colors for countries (could be data-driven)
    worldData.features.forEach((feature) => {
      // Generate a value for color scale (replace with actual data)
      const randomValue = Math.random() * 5;
      countryColors[feature.properties.name] = colorScale(randomValue);
    });

    // Bind data to virtual elements for interaction
    bindDataToVirtualDOM(worldData);

    // Initial render
    drawMap();

    // Set up interaction events
    setupInteraction();
  })
  .catch((error) => console.error("Error loading map data:", error));

// Bind GeoJSON features to virtual DOM elements
function bindDataToVirtualDOM(data) {
  dataContainer
    .selectAll("custom.country")
    .data(data.features)
    .enter()
    .append("custom")
    .classed("country", true)
    .attr("id", (d) => d.properties.name)
    .attr("fillStyle", (d) => countryColors[d.properties.name] || "#ccc")
    .attr("strokeStyle", "#fff")
    .attr("lineWidth", 0.5);
}

// Main drawing function
function drawMap() {
  context.clearRect(0, 0, width, height);

  // Apply current transformation (for zoom/pan)
  context.save();
  context.translate(mapTransform.x, mapTransform.y);
  context.scale(mapTransform.k, mapTransform.k);

  // Add clipping to prevent drawing outside bounds
  addClipPath();

  // Render countries from virtual DOM
  dataContainer.selectAll("custom.country").each(function () {
    const countryElement = d3.select(this);
    const countryData = countryElement.datum();

    // Draw country path
    context.beginPath();
    path(countryData);
    context.fillStyle = countryElement.attr("fillStyle");
    context.fill();

    context.strokeStyle = countryElement.attr("strokeStyle");
    context.lineWidth = countryElement.attr("lineWidth");
    context.stroke();
  });

  context.restore();
}

// Implement hit detection for interactivity with improved interaction
function setupInteraction() {
    const canvasElement = d3.select('#map-canvas');
    
    // Zoom behavior with improved configuration
    const zoom = d3.zoom()
        .scaleExtent([1, 8])  // Limit zoom scale between 1x and 8x
        .translateExtent([[0, 0], [width, height]])  // Limit panning within canvas
        .extent([[0, 0], [width, height]])
        .wheelDelta((event) => {
            // Reduce mouse wheel sensitivity to -0.01× the normal sensitivity
            return -event.deltaY * 0.01;
        })
        .on('zoom', (event) => {
            mapTransform = event.transform;
            drawMap();
        });
    
    // Apply zoom behavior to canvas
    canvasElement.call(zoom);
    
    // Mouse move for hover detection with optimized performance
    canvasElement.on('mousemove', debounce((event) => {
        const [mouseX, mouseY] = d3.pointer(event);
        let hoveredCountry = null;
        
        // Apply inverse of current transform to get correct coordinates
        // This is crucial for hit detection during zoom/pan
        const x = (mouseX - mapTransform.x) / mapTransform.k;
        const y = (mouseY - mapTransform.y) / mapTransform.k;
        
        // Reset all highlights first
        dataContainer.selectAll('custom.country')
            .each(function() {
                const element = d3.select(this);
                if (element.attr('highlighted')) {
                    element.attr('fillStyle', element.attr('originalFill'));
                    element.attr('highlighted', null);
                    element.attr('originalFill', null);
                }
            });
            
        // Check which country contains the point - more efficient approach
        dataContainer.selectAll('custom.country')
            .each(function() {
                const element = d3.select(this);
                const countryData = element.datum();
                
                context.save();
                context.beginPath();
                path(countryData);
                
                if (context.isPointInPath(x, y)) {
                    hoveredCountry = countryData;
                    
                    // Highlight country
                    element.attr('originalFill', element.attr('fillStyle'));
                    element.attr('fillStyle', 'orange');
                    element.attr('highlighted', true);
                }
                
                context.restore();
            });
            
        // Update tooltip
        if (hoveredCountry) {
            tooltip
                .style('opacity', 0.9)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .html(`<strong>${hoveredCountry.properties.name}</strong>`);
        } else {
            tooltip.style('opacity', 0);
        }
        
        // Redraw with highlights
        drawMap();
    }, 10)); // Small debounce to improve performance
    
    // Mouse leave event
    canvasElement.on('mouseleave', () => {
        // Reset all highlights
        dataContainer.selectAll('custom.country')
            .each(function() {
                const element = d3.select(this);
                if (element.attr('highlighted')) {
                    element.attr('fillStyle', element.attr('originalFill'));
                    element.attr('highlighted', null);
                    element.attr('originalFill', null);
                }
            });
            
        tooltip.style('opacity', 0);
        drawMap();
    });
    
    // Button controls with smoother transitions
    d3.select('#reset').on('click', () => {
      mapTransform = d3.zoomIdentity;
      canvasElement.call(zoom.transform, d3.zoomIdentity);
      drawMap(); // 변경 사항 즉시 적용
    });
    
    d3.select('#zoom-in').on('click', () => {
      const newTransform = d3.zoomIdentity
          .translate(mapTransform.x, mapTransform.y)
          .scale(mapTransform.k * 1.2);
      
      mapTransform = newTransform;
      canvasElement.call(zoom.transform, newTransform);
      drawMap();
    });
    
    d3.select('#zoom-out').on('click', () => {
      const newTransform = d3.zoomIdentity
          .translate(mapTransform.x, mapTransform.y)
          .scale(mapTransform.k * 0.8);
      
      mapTransform = newTransform;
      canvasElement.call(zoom.transform, newTransform);
      drawMap();
    });
}

// Add a debounce function to improve performance
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}


// Window resize handler
window.addEventListener("resize", () => {
  // Redraw the map on window resize if needed
  drawMap();
});
