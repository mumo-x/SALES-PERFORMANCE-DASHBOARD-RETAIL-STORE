document.getElementById('uploadButton').addEventListener('click', handleFileUpload);

// Global variable to store the original data
let originalData = [];

// Add event listeners for filters
document.getElementById('categoryFilter').addEventListener('change', applyFilters);
document.getElementById('dateFilter').addEventListener('change', applyFilters);

function handleFileUpload() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Show loading indicator or message
        console.log("Uploading file...");
        
        // Send file to Python backend
        fetch('/upload_csv', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("Received data from server:", data.length, "records");
            originalData = [...data];
            
            // Reset filters to "All" when new data is loaded
            document.getElementById('categoryFilter').value = 'all';
            document.getElementById('dateFilter').value = 'all';
            
            updateDashboard(data);
        })
        .catch(error => {
            console.error('Error uploading file:', error);
            alert('Error uploading file: ' + error.message);
        });
    } else {
        alert('Please select a CSV file to upload.');
    }
}

function applyFilters() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    console.log("Applying filters - Category:", categoryFilter, "Date:", dateFilter);
    
    // Filter the original data based on selected filters
    let filteredData = [...originalData];
    
    if (categoryFilter !== 'all') {
        filteredData = filteredData.filter(item => item.productCategory === categoryFilter);
    }
    
    if (dateFilter !== 'all') {
        filteredData = filteredData.filter(item => item.purchaseDate === dateFilter);
    }
    
    console.log("Filtered data:", filteredData.length, "records");
    
    // Update the dashboard with filtered data
    updateDashboard(filteredData);
}

function updateDashboard(data) {
    if (!data || data.length === 0) {
        console.error("No data to display");
        return;
    }

    // Calculate KPIs
    const totalRevenue = data.reduce((sum, item) => sum + item.totalPrice, 0);
    document.getElementById('totalRevenue').textContent = `AED${totalRevenue.toFixed(2)}`;

    const totalTransactions = data.length;
    document.getElementById('totalTransactions').textContent = totalTransactions;

    const avgOrderValue = totalRevenue / totalTransactions;
    document.getElementById('avgOrderValue').textContent = `AED${avgOrderValue.toFixed(2)}`;

    const avgDiscount = data.reduce((sum, item) => sum + item.discount, 0) / totalTransactions * 100;
    document.getElementById('avgDiscount').textContent = `${avgDiscount.toFixed(1)}%`;

    // Find top category
    const categoryCount = {};
    data.forEach(item => {
        if (categoryCount[item.productCategory]) {
            categoryCount[item.productCategory] += item.totalPrice;
        } else {
            categoryCount[item.productCategory] = item.totalPrice;
        }
    });
    
    let topCategory = '';
    let maxRevenue = 0;
    for (const category in categoryCount) {
        if (categoryCount[category] > maxRevenue) {
            maxRevenue = categoryCount[category];
            topCategory = category;
        }
    }
    document.getElementById('topCategory').textContent = topCategory;

    // Populate category filter - use original data to show all options
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    const uniqueCategories = [...new Set(originalData.map(item => item.productCategory))]
        .filter(category => category && category.trim() !== '')
        .sort();
    
    console.log("Available categories:", uniqueCategories);
    
    uniqueCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    // Populate date filter - use original data to show all options
    const dateFilter = document.getElementById('dateFilter');
    dateFilter.innerHTML = '<option value="all">All Dates</option>';
    const uniqueDates = [...new Set(originalData.map(item => item.purchaseDate))]
        .filter(date => date && date.trim() !== '')
        .sort();
    
    console.log("Available dates:", uniqueDates);
    
    uniqueDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        dateFilter.appendChild(option);
    });

    // Create charts
    createSalesTrendsChart(data);
    createCategoryChart(data);
    createOrderValueChart(data);
    createDiscountChart(data);
    createProductChart(data);
    updateCustomersTable(data);

    // Fetch and update dashboard interpretation markdown
    fetch('/get_dashboard_interpretation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.markdown) {
            // Convert markdown to HTML (simple conversion for basic markdown)
            const html = result.markdown
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^\- (.*$)/gim, '<li>$1</li>')
                .replace(/\n/g, '<br />');
            document.getElementById('dashboardInterpretationContent').innerHTML = html;
        }
    })
    .catch(error => {
        console.error('Error fetching dashboard interpretation:', error);
    });
}

function createSalesTrendsChart(data) {
    console.log("Creating sales trends chart with data:", data.length, "records");
    
    // Group data by date
    const salesByDate = {};
    data.forEach(item => {
        const date = item.purchaseDate ? item.purchaseDate.trim() : 'Unknown';
        const price = item.totalPrice || 0;
        
        if (date !== 'Unknown') {
            if (salesByDate[date]) {
                salesByDate[date] += price;
            } else {
                salesByDate[date] = price;
            }
        }
    });

    // Sort dates
    const sortedDates = Object.keys(salesByDate).sort();
    const salesValues = sortedDates.map(date => salesByDate[date]);

    console.log("Sales by date:", sortedDates, salesValues);

    // Create chart
    const ctx = document.getElementById('salesTrendsChart').getContext('2d');
    if (window.salesTrendsChart && typeof window.salesTrendsChart.destroy === 'function') {
        window.salesTrendsChart.destroy();
    }
    
    window.salesTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Daily Sales',
                data: salesValues,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (AED)'
                    }
                }
            }
        }
    });
}

function createCategoryChart(data) {
    console.log("Creating category chart with data:", data.length, "records");
    
    // Send data to backend for processing
    fetch('/get_category_chart_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Received category chart data from server");
        
        // Create chart
        const ctx = document.getElementById('categoryChart').getContext('2d');
    if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
        window.categoryChart.destroy();
    }
        
window.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
        labels: result.categories,
        datasets: [{
            data: result.revenue,
            backgroundColor: [
                '#667eea', '#764ba2', '#63b3ed', '#4c51bf', '#48bb78',
                '#38b2ac', '#ed8936', '#ed64a6', '#ecc94b', '#f56565'
            ]
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                position: 'right',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = result.percentage[context.dataIndex];
                        const quantity = result.quantity[context.dataIndex];
                        return [
                            `${label}: AED${value.toFixed(2)} (${percentage}%)`,
                            `Units Sold: ${quantity}`
                        ];
                    }
                }
            }
        }
    }
});
    })
    .catch(error => {
        console.error('Error getting category chart data:', error);
    });
}

function createOrderValueChart(data) {
    console.log("Creating order value chart with data:", data.length, "records");
    
    // Send data to backend for processing
    fetch('/get_order_value_chart_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Received order value chart data from server");
        
        // Create chart
        const ctx = document.getElementById('orderValueChart').getContext('2d');
    if (window.orderValueChart && typeof window.orderValueChart.destroy === 'function') {
        window.orderValueChart.destroy();
    }
        
        // Create datasets for stacked bar chart with colors
        const colors = ['#667eea', '#764ba2', '#63b3ed', '#4c51bf', '#48bb78', '#f56565'];
        const datasets = result.datasets.map((dataset, index) => ({
            ...dataset,
            backgroundColor: colors[index % colors.length]
        }));
        
        window.orderValueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: result.ranges,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Number of Orders'
                        }
                    },
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Order Value Range (AED)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            footer: function(tooltipItems) {
                                const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                                return `Total Orders: ${total}`;
                            }
                        }
                    }
                }
            }
        });
    })
    .catch(error => {
        console.error('Error getting order value chart data:', error);
    });
}

function createDiscountChart(data) {
    console.log("Creating discount chart with data:", data.length, "records");
    
    // Send data to backend for processing
    fetch('/get_discount_chart_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Received discount chart data from server");
        
        // Create chart
        const ctx = document.getElementById('discountChart').getContext('2d');
    if (window.discountChart && typeof window.discountChart.destroy === 'function') {
        window.discountChart.destroy();
    }
        
        // Group scatter data by category for color coding
        const categories = Object.keys(result.categoryScatterData);
        const categoryScatterData = categories.map(category => ({
            label: category,
            data: result.categoryScatterData[category],
            backgroundColor: getColorForCategory(category)
        }));
        
        // Create bubble chart
        window.discountChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: categoryScatterData
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Discount Percentage (%)'
                        },
                        min: 0,
                        max: Math.max(35, ...result.scatterData.map(item => item.x)) // Cap at 35% or max discount
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Price ($)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = context.raw;
                                return [
                                    `${item.category}: ${item.product}`,
                                    `Discount: ${item.x.toFixed(1)}%`,
                                    `Revenue: AED${item.y.toFixed(2)}`,
                                    `Quantity: ${item.quantity}`,
                                    `Unit Price: $${item.salesPrice.toFixed(2)}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    })
    .catch(error => {
        console.error('Error getting discount chart data:', error);
    });
}

// Helper function to get consistent colors for categories
function getColorForCategory(category, opacity = 0.7) {
    const baseColors = {
        'Electronics': [102, 126, 234],
        'Fashion': [237, 100, 166],
        'Home Essentials': [72, 187, 120],
        'Office Supplies': [237, 137, 54],
        'Health & Beauty': [236, 201, 75],
        'Uncategorized': [160, 174, 192]
    };
    
    if (baseColors[category]) {
        const [r, g, b] = baseColors[category];
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    // Generate a consistent color based on the category name
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const r = Math.abs(hash % 255);
    const g = Math.abs((hash >> 8) % 255);
    const b = Math.abs((hash >> 16) % 255);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function createProductChart(data) {
    console.log("Creating product chart with data:", data.length, "records");
    
    // Send data to backend for processing
    fetch('/get_product_chart_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Received product chart data from server");
        
        // Create chart
        const ctx = document.getElementById('productChart').getContext('2d');
    if (window.productChart && typeof window.productChart.destroy === 'function') {
        window.productChart.destroy();
    }
        
        // Create datasets by category
        const datasets = Object.entries(result.categoryData).map(([category, products]) => ({
            label: category,
            data: products,
            backgroundColor: getColorForCategory(category),
            borderColor: getColorForCategory(category, 0.8),
            borderWidth: 1
        }));
        
        window.productChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Units Sold (Quantity)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Revenue (AED)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const product = context.raw;
                                return [
                                    `${product.name} (${product.category})`,
                                    `Revenue: $${product.y.toFixed(2)}`,
                                    `Units Sold: ${product.x}`,
                                    `Avg. Price: $${product.avgPrice.toFixed(2)}`,
                                    `Transactions: ${product.transactions}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    })
    .catch(error => {
        console.error('Error getting product chart data:', error);
    });
}

function updateCustomersTable(data) {
    console.log("Updating customers table with data:", data.length, "records");
    
    // Send data to backend for processing
    fetch('/get_customers_table_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(customers => {
        console.log("Received customers table data from server");
        
        // Update table
        const tableBody = document.getElementById('customersTableBody');
        tableBody.innerHTML = '';
        
        if (customers.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.textContent = 'No customer data available';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }
        
        customers.forEach(customer => {
            const row = document.createElement('tr');
            
            const idCell = document.createElement('td');
            idCell.textContent = customer.customerId;
            
            const spentCell = document.createElement('td');
            spentCell.textContent = `AED${customer.totalPrice.toFixed(2)}`;
            
            const ordersCell = document.createElement('td');
            ordersCell.textContent = customer.orderCount;
            
            const aovCell = document.createElement('td');
            aovCell.textContent = `AED${customer.aov.toFixed(2)}`;
            
            const lastPurchaseCell = document.createElement('td');
            lastPurchaseCell.textContent = customer.lastPurchase || 'N/A';
            
            row.appendChild(idCell);
            row.appendChild(spentCell);
            row.appendChild(ordersCell);
            row.appendChild(aovCell);
            row.appendChild(lastPurchaseCell);
            
            tableBody.appendChild(row);
        });
    })
    .catch(error => {
        console.error('Error getting customers table data:', error);
    });
}