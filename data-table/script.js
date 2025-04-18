// Main function to initialize the datatable
function initializeDataTable() {
  // Parse the CSV data (Assuming the data is loaded as a string)
  d3.csv("Chocolate-Sales.csv")
    .then(function (data) {
      // Process the data to ensure proper types
      const processedData = data.map((d) => {
        // Parse the Amount column to remove $ and commas and convert to number
        const amountStr = d.Amount.replace("$", "").replace(",", "").trim();

        return {
          "Sales Person": d["Sales Person"],
          Country: d.Country,
          Product: d.Product,
          Date: new Date(d.Date),
          Amount: parseFloat(amountStr),
          "Boxes Shipped": +d["Boxes Shipped"], // Convert to number
        };
      });

      // Store the original data for filtering
      const originalData = [...processedData];

      // Set up the table structure
      const columns = Object.keys(processedData[0]);

      // Configuration for the table
      let config = {
        data: processedData,
        pageSize: 10,
        currentPage: 1,
        sortColumn: null,
        sortDirection: "asc",
        filters: {},
      };

      // Create table elements
      const table = d3
        .select("#datatable")
        .append("table")
        .attr("id", "chocolate-sales-table");

      const thead = table.append("thead");
      const tbody = table.append("tbody");

      // Create header row with filter inputs
      const headerRow = thead.append("tr");

      columns.forEach((column) => {
        const th = headerRow
          .append("th")
          .attr("data-column", column)
          .html(`<div>${column}<span class="sort-icon"></span></div>`)
          .on("click", function () {
            handleSort(column);
          });

        // Add filter input below header
        th.append("div")
          .attr("class", "column-filter")
          .html(() => {
            if (
              column === "Country" ||
              column === "Product" ||
              column === "Sales Person"
            ) {
              // Create dropdown filter for categorical columns
              const uniqueValues = [
                ...new Set(processedData.map((d) => d[column])),
              ].sort();
              let options = '<option value="">All</option>';
              uniqueValues.forEach((value) => {
                options += `<option value="${value}">${value}</option>`;
              });
              return `<select data-filter="${column}">${options}</select>`;
            } else {
              // Create text input filter for other columns
              return `<input type="text" data-filter="${column}" placeholder="Filter...">`;
            }
          });
      });

      // Add event listeners for filters
      d3.selectAll("[data-filter]").on("input change", function () {
        const filterColumn = d3.select(this).attr("data-filter");
        const filterValue = this.value;

        if (filterValue) {
          config.filters[filterColumn] = filterValue;
        } else {
          delete config.filters[filterColumn];
        }

        config.currentPage = 1;
        updateTable();
      });

      // Add global search functionality
      d3.select(".global-search").on("input", function () {
        const searchValue = this.value.toLowerCase();
        if (searchValue) {
          config.globalSearch = searchValue;
        } else {
          config.globalSearch = null;
        }

        config.currentPage = 1;
        updateTable();
      });

      // Add pagination event listeners
      d3.select("#prev-page").on("click", function () {
        if (config.currentPage > 1) {
          config.currentPage--;
          updateTable();
        }
      });

      d3.select("#next-page").on("click", function () {
        const totalPages = Math.ceil(
          getFilteredData().length / config.pageSize
        );
        if (config.currentPage < totalPages) {
          config.currentPage++;
          updateTable();
        }
      });

      // Function to handle sorting
      function handleSort(column) {
        // If clicking on the same column, toggle direction
        if (config.sortColumn === column) {
          config.sortDirection =
            config.sortDirection === "asc" ? "desc" : "asc";
        } else {
          config.sortColumn = column;
          config.sortDirection = "asc";
        }

        updateTable();
      }

      // Function to apply filters and search
      function getFilteredData() {
        let filtered = [...originalData];

        // Apply column filters
        Object.keys(config.filters).forEach((column) => {
          const filterValue = config.filters[column];

          if (column === "Date") {
            // Handle date filtering
            filtered = filtered.filter((d) => {
              return d[column].toISOString().includes(filterValue);
            });
          } else if (column === "Amount" || column === "Boxes Shipped") {
            // Handle numeric filtering
            filtered = filtered.filter((d) => {
              return d[column].toString().includes(filterValue);
            });
          } else {
            // Handle text filtering (case insensitive)
            filtered = filtered.filter((d) => {
              return d[column]
                .toLowerCase()
                .includes(filterValue.toLowerCase());
            });
          }
        });

        // Apply global search
        if (config.globalSearch) {
          filtered = filtered.filter((d) => {
            return Object.values(d).some((value) => {
              return value
                .toString()
                .toLowerCase()
                .includes(config.globalSearch);
            });
          });
        }

        // Apply sorting
        if (config.sortColumn) {
          filtered.sort((a, b) => {
            const valueA = a[config.sortColumn];
            const valueB = b[config.sortColumn];

            let comparison = 0;
            if (valueA > valueB) {
              comparison = 1;
            } else if (valueA < valueB) {
              comparison = -1;
            }

            return config.sortDirection === "desc"
              ? comparison * -1
              : comparison;
          });
        }

        return filtered;
      }

      // Function to update the table with filtered and sorted data
      function updateTable() {
        const filteredData = getFilteredData();

        // Update pagination
        const totalRecords = filteredData.length;
        const totalPages = Math.ceil(totalRecords / config.pageSize);

        const startIndex = (config.currentPage - 1) * config.pageSize;
        const endIndex = Math.min(startIndex + config.pageSize, totalRecords);

        // Update pagination info
        d3.select("#start-record").text(
          totalRecords === 0 ? 0 : startIndex + 1
        );
        d3.select("#end-record").text(endIndex);
        d3.select("#total-records").text(totalRecords);

        // Enable/disable pagination buttons
        d3.select("#prev-page").property("disabled", config.currentPage === 1);
        d3.select("#next-page").property(
          "disabled",
          config.currentPage >= totalPages
        );

        // Get visible data for current page
        const pageData = filteredData.slice(startIndex, endIndex);

        // Update sort indicators
        d3.selectAll("th span").attr("class", "sort-icon");

        if (config.sortColumn) {
          d3.select(`th[data-column="${config.sortColumn}"] span`).attr(
            "class",
            config.sortDirection === "asc" ? "sort-asc" : "sort-desc"
          );
        }

        // Bind data to table rows
        const rows = tbody
          .selectAll("tr")
          .data(
            pageData,
            (d) => `${d["Sales Person"]}-${d.Country}-${d.Product}-${d.Date}`
          );

        // Remove rows that no longer have data bound to them
        rows.exit().remove();

        // Add new rows for new data
        const newRows = rows.enter().append("tr");

        // Update all rows (existing and new)
        const allRows = newRows.merge(rows);

        // Clear existing cells
        allRows.selectAll("td").remove();

        // Add cells to rows
        allRows
          .selectAll("td")
          .data((d) => columns.map((column) => ({ column, value: d[column] })))
          .enter()
          .append("td")
          .text((d) => {
            if (d.column === "Date") {
              return d.value.toLocaleDateString();
            } else if (d.column === "Amount") {
              return `$${d.value.toFixed(2)}`;
            } else {
              return d.value;
            }
          });
      }

      // Initialize the table
      updateTable();
    })
    .catch(function (error) {
      console.error("Error loading the CSV data:", error);
      d3.select("#datatable").html(
        '<p class="error">Error loading data. Please check the console for details.</p>'
      );
    });
}

// Call the initialization function when the DOM is ready
document.addEventListener("DOMContentLoaded", initializeDataTable);
