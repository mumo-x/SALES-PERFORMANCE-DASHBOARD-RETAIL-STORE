# Sales Performance Dashboard

This project is a Sales Performance Dashboard web application that provides comprehensive analytics on retail transaction data. It includes features such as CSV data upload, interactive charts, filtering, and dynamic dashboard interpretation.

## Features

- Upload CSV files containing retail transaction data.
- Interactive charts including:
  - Sales Trends Over Time (line chart)
  - Revenue by Product Category (doughnut chart)
  - Order Value Distribution (stacked bar chart)
  - Discount Impact Analysis (bubble chart)
  - Product Performance (scatter chart)
  - Top Customers Table
- Dynamic filtering by product category and purchase date.
- Dashboard Interpretation section that provides markdown-based insights based on the uploaded data.
- Responsive and user-friendly interface.

## Technologies Used

- Python Flask for backend API and data processing.
- Pandas for data manipulation.
- Chart.js for frontend chart rendering.
- HTML, CSS, and JavaScript for frontend UI.

## Setup and Running

1. Install required Python packages:
   ```
   pip install -r requirements.txt
   ```

2. Run the Flask application:
   ```
   python chart_functions.py
   ```

3. Open a web browser and navigate to:
   ```
   http://localhost:5000
   ```

4. Upload a CSV file with retail transaction data to start analyzing.

## CSV Data Format

The CSV file should contain the following columns (case-insensitive):

- Product Category
- Product Purchased
- Quantity
- Sales Price
- Discount
- Total Price
- Customer Id
- Invoice Id
- Purchase Date

## Notes

- The dashboard dynamically updates charts and interpretation based on the uploaded data and applied filters.
- The Dashboard Interpretation section provides key insights such as top revenue categories, best sales days, highest value orders, and best-selling products.

## Future Improvements

- Add more detailed analysis and visualizations.
- Support for exporting reports.
- User authentication and data persistence.

## Contact

For any questions or feedback, please contact the developer via designerssplendor@gmail.com.
