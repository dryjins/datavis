/* ======  JavaScript (app.js)  ======
 *
 * High‑level file structure
 * ├─ 1) CONSTANTS & SCAFFOLDING
 * ├─ 2) DATA LOADING & PRE‑PROCESSING
 * ├─ 3) VISUALIZATION BUILD FUNCTIONS
 * │     • buildAreaChart()
 * │     • buildBarChart()
 * │     • buildDataTable()
 * ├─ 4) UPDATE FUNCTIONS (called by global state)
 * └─ 5) EVENT HANDLERS & GLOBAL STATE
 * ———————————————————————————————— */

/* ──────────────────────────────────────────────────
 1) CONSTANTS & SCAFFOLDING
────────────────────────────────────────────────── */
const FILE = 'Chocolate-Sales.csv';          // cleaned CSV placed alongside site
const DATE_FMT = d3.timeParse('%d-%b-%y');
const MONTH_FMT = d3.timeFormat('%Y-%m');          // used as key after aggregation

const rowsPerPage = 10;                            // datatable pagination size
let rawData           = [];                        // original transactions
let monthlyAgg        = [];                        // {month, total}
let categoryAgg       = [];                        // {product, total}

/* Containers for D3 selections (created once, reused) */
const areaSvg    = d3.select('#area-chart');
const ctxSvg     = d3.select('#context-chart');
const barSvg     = d3.select('#bar-chart');
const tableHead  = d3.select('#data-table thead');
const tableBody  = d3.select('#data-table tbody');
const pagDiv     = d3.select('#pagination');

/* Color scales shared across views for cohesion */
const areaColor = '#7aaaFF';
const ctxColor  = '#c7d3ff';
const catColor  = d3.scaleOrdinal(d3.schemeTableau10);

/* ──────────────────────────────────────────────────
 2) DATA LOADING & PRE‑PROCESSING
────────────────────────────────────────────────── */
d3.csv(FILE, d => ({
  ...d,
  Amount: +d.Amount.replace(/[$,]/g, ''),          // strip '$' and commas ➜ number
  Date  : DATE_FMT(d.Date)
})).then(data => {
  rawData = data;

  /* --- Monthly aggregation for area chart --- */
  const monthlyMap = d3.rollup(
    rawData,
    v => d3.sum(v, d => d.Amount),
    d => MONTH_FMT(d.Date)                         // key: 'YYYY-MM'
  );
  monthlyAgg = Array.from(monthlyMap, ([key, total]) => ({
    month: d3.timeParse('%Y-%m')(key),
    total
  })).sort((a, b) => d3.ascending(a.month, b.month));

  /* --- Category totals for stacked bar (initial state) --- */
  computeCategoryAgg();

  /* Build visualizations once after data ready */
  buildAreaChart();
  buildBarChart();
  buildDataTable();

  /* Hook up Reset button */
  d3.select('#reset-btn').on('click', () => {
    appState.reset();
  });
});

/* Pre‑compute category totals (can be recalled on state changes) */
function computeCategoryAgg(filterData = rawData) {
  const map = d3.rollup(
    filterData,
    v => d3.sum(v, d => d.Amount),
    d => d.Product
  );
  categoryAgg = Array.from(map, ([product, total]) => ({ product, total }));
}

/* ──────────────────────────────────────────────────
 3)  VISUALIZATION BUILDERS
────────────────────────────────────────────────── */

/** Build focus+context area chart with brush */
function buildAreaChart() {
  const margin = { top: 10, right: 15, bottom: 60, left: 45 };
  const ctxMargin = { top: 4, right: 15, bottom: 20, left: 45 };

  const width  = areaSvg.node().clientWidth  - margin.left - margin.right;
  const height = areaSvg.node().clientHeight - margin.top  - margin.bottom;
  const ctxH   = ctxSvg .node().clientHeight - ctxMargin.top - ctxMargin.bottom;

  // Scales
  const x = d3.scaleTime()
    .domain(d3.extent(monthlyAgg, d => d.month))
    .range([0, width]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(monthlyAgg, d => d.total)]).nice()
    .range([height, 0]);

  // Area generators
  const areaGen = d3.area()
    .x(d => x(d.month))
    .y0(height)
    .y1(d => y(d.total));

  /* -------- FOCUS chart -------- */
  const g = areaSvg
    .attr('viewBox', [0, 0, width + margin.left + margin.right,
                             height + margin.top + margin.bottom])
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

 // Add clipPath definition
 g.append("defs").append("clipPath")
  .attr("id", "clip-area")
  .append("rect")
    .attr("width", width)
    .attr("height", height);
 
 // Update path to use clipPath
 g.append('path')
    .datum(monthlyAgg)
    .attr('fill', areaColor)
    .attr('clip-path', "url(#clip-area)")  // Add this line
    .attr('d', areaGen);

  // Axes
  g.append('g')
      .attr('class', 'x‑axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));
  g.append('g')
      .attr('class', 'y‑axis')
      .call(d3.axisLeft(y).ticks(6, 's'));

  /* -------- CONTEXT chart (overview) -------- */
  const ctxX = x.copy();
  const ctxY = d3.scaleLinear()
    .domain(y.domain())
    .range([ctxH, 0]);

  const ctxArea = d3.area()
    .x(d => ctxX(d.month))
    .y0(ctxH)
    .y1(d => ctxY(d.total));

  const ctxG = ctxSvg
    .attr('viewBox', [0, 0, width + ctxMargin.left + ctxMargin.right,
                             ctxH + ctxMargin.top + ctxMargin.bottom])
    .append('g')
      .attr('transform', `translate(${ctxMargin.left},${ctxMargin.top})`);

  ctxG.append('path')
      .datum(monthlyAgg)
      .attr('fill', ctxColor)
      .attr('d', ctxArea);

  ctxG.append('g')
      .attr('class', 'x‑axis')
      .attr('transform', `translate(0,${ctxH})`)
      .call(d3.axisBottom(ctxX).ticks(width < 500 ? 4 : 8));

  /* ---- Brush (X only) ---- */
  const brush = d3.brushX()
    .extent([[0, 0], [width, ctxH]])
    .on('end', handleBrush);

  ctxG.append('g')
      .attr('class', 'brush')
      .call(brush);

  /* ------- Update helper for focus chart ------- */
  function zoom(newXDomain) {
    x.domain(newXDomain);
    g.select('path').transition().duration(600).attr('d', areaGen);
    g.select('.x‑axis').transition().duration(600).call(d3.axisBottom(x).tickSizeOuter(0));
  }

  /* ---- Event handler passed via closure ---- */
  function handleBrush({ selection }) {
    if (!selection) return;                         // clicks outside clear brush
    const [x0, x1] = selection.map(ctxX.invert);
    appState.updateTimeRange([x0, x1]);            // push to global state
    zoom([x0, x1]);
  }

  /* -- Expose zoom so appState can reset focus when filters clear -- */
  buildAreaChart.zoom = zoom;
}

/** Build (simple, one‑layer) stacked bar ‑‑ category totals */
function buildBarChart() {
  const margin = { top: 10, right: 15, bottom: 50, left: 60 };
  const width  = barSvg.node().clientWidth  - margin.left - margin.right;
  const height = barSvg.node().clientHeight - margin.top  - margin.bottom;

  const x = d3.scaleBand()
     .domain(categoryAgg.map(d => d.product))
     .range([0, width])
     .padding(0.2);

  const y = d3.scaleLinear()
     .domain([0, d3.max(categoryAgg, d => d.total)]).nice()
     .range([height, 0]);

  const g = barSvg
     .attr('viewBox', [0, 0, width + margin.left + margin.right,
                              height + margin.top + margin.bottom])
     .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

  g.selectAll('.bar')
     .data(categoryAgg)
     .enter().append('rect')
       .attr('class', 'bar')
       .attr('x', d => x(d.product))
       .attr('y', d => y(d.total))
       .attr('width', x.bandwidth())
       .attr('height', d => y(0) - y(d.total))
       .attr('fill', d => catColor(d.product))
       .on('click', (event, d) => {
         appState.updateSelectedProduct(
           appState.selectedProduct === d.product ? null : d.product
         );
       });

  // Axes
  const xAxis = g.append('g')
     .attr('transform', `translate(0,${height})`)
     .call(d3.axisBottom(x))
     .selectAll('text')             // wrap long labels if needed
       .attr('transform', 'rotate(-35)')
       .style('text-anchor', 'end');

  g.append('g')
     .call(d3.axisLeft(y).ticks(6, 's'));

  buildBarChart.x = x;
  buildBarChart.y = y;
  buildBarChart.g = g;
}

/** Build interactive datatable: sort, filter, pagination, row click */
function buildDataTable() {
  /* -------- column meta (displayName, accessor) -------- */
  const columns = [
    { label: 'Sales Person',  key: 'Sales Person' },
    { label: 'Country',       key: 'Country' },
    { label: 'Product',       key: 'Product' },
    { label: 'Date',          key: 'Date',  fmt: d3.timeFormat('%d‑%b‑%y') },
    { label: 'Amount',        key: 'Amount', fmt: d3.format('$,.2f') },
    { label: 'Boxes Shipped', key: 'Boxes Shipped' }
  ];

  /* ------------- BUILD HEADER (two rows) -------------
   * Row 1: column titles (click to sort)
   * Row 2: <input> filters                               */
  const sortState = {};
  const headerRow  = tableHead.append('tr');
  const filterRow  = tableHead.append('tr');

  columns.forEach(col => {
    /* Sortable header */
    headerRow.append('th')
      .text(col.label)
      .on('click', () => {
        const current = sortState.key === col.key && sortState.asc;
        sortState.key = col.key;
        sortState.asc = !current;             // toggle asc/desc
        renderTable();                        // rerender page 1
      });

    /* Filter input */
    filterRow.append('th')
      .append('input')
        .attr('type', 'text')
        .attr('placeholder', 'filter…')
        .on('input', renderTable);           // live filtering
  });

  /* ---- Pagination scaffolding ---- */
  let currentPage = 1;

  function renderTable(resetPage = true) {
    if (resetPage) currentPage = 1;          // go back to first page on filter/sort

    /* ---- 1) build filtered set ---- */
    let filtered = rawData
      .filter(d => appState.timeRange === null ||
        (d.Date >= appState.timeRange[0] && d.Date <= appState.timeRange[1]))
      .filter(d => appState.selectedProduct === null ||
        d.Product === appState.selectedProduct);

    // Column text filters
    filterRow.selectAll('input').each(function(_, i) {
      const val = this.value.trim().toLowerCase();
      if (val) {
        const key = columns[i].key;
        filtered = filtered.filter(row => String(row[key]).toLowerCase().includes(val));
      }
    });

    /* ---- 2) sort, if any ---- */
    if (sortState.key) {
      const k = sortState.key;
      filtered.sort((a, b) =>
        sortState.asc ? d3.ascending(a[k], b[k]) : d3.descending(a[k], b[k])
      );
    }

    /* ---- 3) paginate ---- */
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const pageData   = filtered.slice(
      (currentPage - 1) * rowsPerPage,
       currentPage    * rowsPerPage
    );

    /* ---- 4) render rows ---- */
    const rows = tableBody.selectAll('tr')
      .data(pageData, d => d.id || JSON.stringify(d));  // stable key

    rows.exit().remove();

    const enter = rows.enter().append('tr')
      .on('click', function(event, d) {
        // toggle selected status
        const idx = appState.selectedRows.indexOf(d);
        if (idx > -1) {
          appState.selectedRows.splice(idx, 1);
        } else {
          appState.selectedRows.push(d);
        }
        appState.notifyVisualizations();     // propagate
      });

    // (re)fill every cell each refresh to keep simple
    enter.merge(rows).html('')               // clear existing
      .classed('selected', d => appState.selectedRows.includes(d))
      .each(function(row) {
        const tr = d3.select(this);
        columns.forEach(col => {
          tr.append('td')
            .text(col.fmt ? col.fmt(row[col.key]) : row[col.key]);
        });
      });

    /* ---- 5) build / update pagination buttons ---- */
    const btns = pagDiv.selectAll('.paginate-btn')
      .data(d3.range(1, totalPages + 1));

    btns.exit().remove();

    btns.enter().append('span')
        .attr('class', 'paginate-btn')
      .merge(btns)
        .classed('active', d => d === currentPage)
        .text(d => d)
        .on('click', (_, d) => { currentPage = d; renderTable(false); });
  }

  /* expose for global updates */
  buildDataTable.render = renderTable;

  // Initial draw
  renderTable();
}

/* ──────────────────────────────────────────────────
 4)  UPDATE FUNCTIONS (called by global state)
────────────────────────────────────────────────── */

/** Called when state changes to refresh bar chart */
function updateBarChart(state) {
  /* Re‑compute totals given filters */
  const filtered = rawData.filter(d =>
      (state.timeRange === null ||
        (d.Date >= state.timeRange[0] && d.Date <= state.timeRange[1])));

  computeCategoryAgg(filtered);             // updates global categoryAgg

  const g = buildBarChart.g;
  const x = buildBarChart.x
      .domain(categoryAgg.map(d => d.product))
      .padding(0.2);
  const y = buildBarChart.y
      .domain([0, d3.max(categoryAgg, d => d.total)]).nice();

  /* JOIN */
  const bars = g.selectAll('.bar').data(categoryAgg, d => d.product);

  /* EXIT */
  bars.exit().transition().duration(400)
      .attr('height', 0)
      .attr('y', y(0))
      .remove();

  /* UPDATE + ENTER */
  bars.enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.product))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', d => catColor(d.product))
      .on('click', (event, d) => {
        state.updateSelectedProduct(
          state.selectedProduct === d.product ? null : d.product
        );
      })
    .merge(bars)                                                    // UPDATE
      .transition().duration(600)
      .attr('x', d => x(d.product))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.total))
      .attr('height', d => y(0) - y(d.total))
      .attr('opacity', d =>
        state.selectedProduct && state.selectedProduct !== d.product ? 0.35 : 1);

  /* update axes */
  g.select('.y‑axis').transition().duration(600).call(d3.axisLeft(y).ticks(6, 's'));
  g.select('.x‑axis')
    .transition().duration(600)
    .call(d3.axisBottom(x))
    .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end');
}

/** Refresh table on state change */
function updateDataTable(state) {
  buildDataTable.render();                   // reuses internal logic
}

/** Area chart only needs to zoom out/reset when brush cleared */
function updateAreaChart(state) {
  if (state.timeRange === null) {
    // Reset x domain to full range
    const full = d3.extent(monthlyAgg, d => d.month);
    buildAreaChart.zoom(full);
  }
}

/* ──────────────────────────────────────────────────
 5)  GLOBAL STATE  (single source of truth)
────────────────────────────────────────────────── */
const appState = {
  timeRange:       null,  // [Date, Date]  | null
  selectedProduct: null,  // string        | null
  selectedRows:    [],    // array of row objects

  /* --- Mutation helpers (all flow through notify) --- */
  updateTimeRange(range) {
    this.timeRange = range;
    this.notifyVisualizations();
  },
  updateSelectedProduct(prod) {
    this.selectedProduct = prod;
    this.notifyVisualizations();
  },
  updateSelectedRows(rows) {
    this.selectedRows = rows;
    this.notifyVisualizations();
  },
  reset() {
    this.timeRange       = null;
    this.selectedProduct = null;
    this.selectedRows    = [];
    this.notifyVisualizations();
  },

  /* --- Push state to every visual --- */
  notifyVisualizations() {
    updateAreaChart(this);
    updateBarChart(this);
    updateDataTable(this);
  }
};
