import pandas as pd
import json
from flask import Flask, request, jsonify, render_template, send_from_directory
import os

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('.', 'index_updated.html')

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    """
    Handle CSV file upload and process the data
    Returns processed data as JSON for the frontend
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.csv'):
        try:
            # Read CSV file
            df = pd.read_csv(file)
            
            # Process data
            processed_data = process_csv_data(df)
            
            return jsonify(processed_data)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'File must be a CSV'}), 400

def process_csv_data(df):
    """
    Process the CSV data and return a structured format for the frontend
    """
    # Clean column names and handle missing values
    df.columns = [col.strip() for col in df.columns]
    
    # Map CSV columns to expected names
    column_mapping = {
        'Product Category': 'productCategory',
        'Product Purchased': 'productPurchased',
        'Quantity': 'quantity',
        'Sales Price': 'salesPrice',
        'Discount': 'discount',
        'Total Price': 'totalPrice',
        'Customer Id': 'customerId',
        'Invoice Id': 'invoiceId',
        'Purchase Date': 'purchaseDate'
    }
    
    # Rename columns if they exist
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns:
            df = df.rename(columns={old_col: new_col})
    
    # Convert numeric columns
    numeric_cols = ['quantity', 'salesPrice', 'discount', 'totalPrice']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Fill NaN values
    df = df.fillna({
        'quantity': 0,
        'salesPrice': 0,
        'discount': 0,
        'totalPrice': 0,
        'productCategory': 'Uncategorized',
        'productPurchased': 'Unknown Product',
        'customerId': 'Unknown',
        'invoiceId': 'Unknown',
        'purchaseDate': 'Unknown'
    })
    
    # Convert to list of dictionaries for JSON serialization
    data = df.to_dict(orient='records')
    
    return data

@app.route('/get_category_chart_data', methods=['POST'])
def get_category_chart_data():
    """
    Generate Revenue by Product Category Chart data
    """
    try:
        data = request.json
        print("get_category_chart_data received data:", data[:3])  # Log first 3 records
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame(data)
        print("DataFrame head:", df.head())
        
        # Group data by category
        category_data = df.groupby('productCategory').agg({
            'totalPrice': 'sum',
            'quantity': 'sum'
        }).reset_index()
        print("Grouped category data:", category_data.head())
        
        # Sort by revenue (descending)
        category_data = category_data.sort_values('totalPrice', ascending=False)
        
        # Calculate percentage of total revenue
        total_revenue = category_data['totalPrice'].sum()
        category_data['percentage'] = (category_data['totalPrice'] / total_revenue * 100).round(1)
        
        # Prepare response
        result = {
            'categories': category_data['productCategory'].tolist(),
            'revenue': category_data['totalPrice'].tolist(),
            'quantity': category_data['quantity'].tolist(),
            'percentage': category_data['percentage'].tolist()
        }
        
        return jsonify(result)
    except Exception as e:
        print("Error in get_category_chart_data:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/get_order_value_chart_data', methods=['POST'])
def get_order_value_chart_data():
    """
    Generate Order Value Distribution Chart data
    """
    try:
        data = request.json
        print("get_order_value_chart_data received data:", data[:3])  # Log first 3 records
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame(data)
        print("DataFrame head:", df.head())
        
        # Group by invoice ID to get unique transactions
        invoice_data = df.groupby('invoiceId').agg({
            'totalPrice': 'sum',
            'productCategory': 'first',
            'customerId': 'first'
        }).reset_index()
        print("Grouped invoice data:", invoice_data.head())
        
        # Define ranges
        ranges = ['0-50', '51-100', '101-200', '201-500', '501+']
        
        # Create range bins
        def get_range_index(value):
            if value <= 50:
                return 0
            elif value <= 100:
                return 1
            elif value <= 200:
                return 2
            elif value <= 500:
                return 3
            else:
                return 4
        
        invoice_data['range_index'] = invoice_data['totalPrice'].apply(get_range_index)
        
        # Count by category for each range
        category_range_counts = {}
        for category in df['productCategory'].unique():
            category_invoices = invoice_data[invoice_data['productCategory'] == category]
            counts = [0, 0, 0, 0, 0]
            for idx in range(5):
                counts[idx] = len(category_invoices[category_invoices['range_index'] == idx])
            category_range_counts[category] = counts
        print("Category range counts:", category_range_counts)
        
        # Get overall counts for each range
        range_counts = [0, 0, 0, 0, 0]
        for idx in range(5):
            range_counts[idx] = len(invoice_data[invoice_data['range_index'] == idx])
        print("Range counts:", range_counts)
        
        # Get top 5 categories
        top_categories = sorted(
            category_range_counts.items(),
            key=lambda x: sum(x[1]),
            reverse=True
        )[:5]
        
        # Prepare datasets for stacked bar chart
        datasets = []
        for category, counts in top_categories:
            datasets.append({
                'label': category,
                'data': counts
            })
        
        # Add "Other" category if needed
        other_categories = [cat for cat in category_range_counts.keys() 
                           if cat not in [c[0] for c in top_categories]]
        
        if other_categories:
            other_data = [0, 0, 0, 0, 0]
            for cat in other_categories:
                for i in range(5):
                    other_data[i] += category_range_counts[cat][i]
            
            datasets.append({
                'label': 'Other Categories',
                'data': other_data
            })
        print("Datasets prepared:", datasets)
        
        # Prepare response
        result = {
            'ranges': ranges,
            'rangeCounts': range_counts,
            'datasets': datasets
        }
        
        return jsonify(result)
    except Exception as e:
        print("Error in get_order_value_chart_data:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/get_discount_chart_data', methods=['POST'])
def get_discount_chart_data():
    """
    Generate Discount Impact Analysis Chart data
    """
    try:
        data = request.json
        print("get_discount_chart_data received data:", data[:3])  # Log first 3 records
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame(data)
        print("DataFrame head:", df.head())
        
        # Filter valid data for scatter plot
        scatter_df = df.dropna(subset=['discount', 'totalPrice', 'quantity'])
        print("Filtered scatter data:", scatter_df.head())
        
        # Prepare data for bubble chart
        scatter_data = []
        for _, row in scatter_df.iterrows():
            scatter_data.append({
                'x': float(row['discount'] * 100),  # Convert to percentage
                'y': float(row['totalPrice']),
                'r': float(max(3, min(20, (row['quantity'] ** 0.5) * 5))),  # Scale bubble size
                'category': row['productCategory'],
                'salesPrice': float(row['salesPrice']),
                'quantity': int(row['quantity']),
                'product': row['productPurchased']
            })
        print("Scatter data prepared:", scatter_data[:3])
        
        # Group by discount ranges
        discount_ranges = ['0%', '1-10%', '11-20%', '21-30%', '31%+']
        
        def get_discount_range(discount):
            discount_pct = discount * 100
            if discount_pct == 0:
                return 0
            elif discount_pct <= 10:
                return 1
            elif discount_pct <= 20:
                return 2
            elif discount_pct <= 30:
                return 3
            else:
                return 4
        
        df['discount_range'] = df['discount'].apply(get_discount_range)
        
        # Calculate metrics for each range
        discount_counts = [0, 0, 0, 0, 0]
        discount_impact = [0, 0, 0, 0, 0]  # Total discount amount
        discount_revenue = [0, 0, 0, 0, 0]  # Total revenue
        
        for _, row in df.iterrows():
            if pd.notna(row['discount']):
                range_idx = int(row['discount_range'])
                discount_counts[range_idx] += 1
                discount_revenue[range_idx] += float(row['totalPrice'])
                
                # Calculate discount amount
                discount_amount = float(row['salesPrice']) * float(row['quantity']) * float(row['discount'])
                discount_impact[range_idx] += discount_amount
        print("Discount counts:", discount_counts)
        print("Discount impact:", discount_impact)
        print("Discount revenue:", discount_revenue)
        
        # Group scatter data by category
        categories = df['productCategory'].unique().tolist()
        category_scatter_data = {}
        
        for category in categories:
            category_scatter_data[category] = [
                item for item in scatter_data if item['category'] == category
            ]
        print("Category scatter data keys:", list(category_scatter_data.keys()))
        
        # Prepare response
        result = {
            'scatterData': scatter_data,
            'categoryScatterData': category_scatter_data,
            'discountRanges': discount_ranges,
            'discountCounts': discount_counts,
            'discountImpact': discount_impact,
            'discountRevenue': discount_revenue
        }
        
        return jsonify(result)
    except Exception as e:
        print("Error in get_discount_chart_data:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/get_product_chart_data', methods=['POST'])
def get_product_chart_data():
    """
    Generate Product Performance Chart data
    """
    try:
        data = request.json
        print("get_product_chart_data received data:", data[:3])  # Log first 3 records
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame(data)
        print("DataFrame head:", df.head())
        
        # Group by product
        product_data = df.groupby('productPurchased').agg({
            'quantity': 'sum',
            'totalPrice': 'sum',
            'productCategory': 'first',
            'salesPrice': lambda x: (x * df.loc[x.index, 'quantity']).sum(),
            'invoiceId': 'nunique'
        }).reset_index()
        print("Grouped product data:", product_data.head())
        
        # Calculate average selling price
        product_data['avgPrice'] = product_data['salesPrice'] / product_data['quantity']
        
        # Rename columns for clarity
        product_data = product_data.rename(columns={
            'invoiceId': 'transactions'
        })
        
        # Sort by revenue and get top products
        top_products = product_data.sort_values('totalPrice', ascending=False).head(15)
        print("Top products:", top_products)
        
        # Prepare scatter plot data
        scatter_data = []
        for _, row in top_products.iterrows():
            scatter_data.append({
                'x': int(row['quantity']),
                'y': float(row['totalPrice']),
                'name': row['productPurchased'],
                'category': row['productCategory'],
                'avgPrice': float(row['avgPrice']),
                'transactions': int(row['transactions'])
            })
        
        # Group by category
        category_data = {}
        for item in scatter_data:
            category = item['category']
            if category not in category_data:
                category_data[category] = []
            category_data[category].append(item)
        print("Category data keys:", list(category_data.keys()))
        
        # Prepare response
        result = {
            'scatterData': scatter_data,
            'categoryData': category_data
        }
        
        return jsonify(result)
    except Exception as e:
        print("Error in get_product_chart_data:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/get_customers_table_data', methods=['POST'])
def get_customers_table_data():
    """
    Generate Top Customers Table data
    """
    try:
        data = request.json
        
        # Convert to DataFrame for easier processing
        df = pd.DataFrame(data)
        
        # Group by customer
        customer_data = df.groupby('customerId').agg({
            'totalPrice': 'sum',
            'invoiceId': lambda x: len(x.unique()),
            'purchaseDate': 'max'
        }).reset_index()
        
        # Calculate average order value
        customer_data['aov'] = customer_data['totalPrice'] / customer_data['invoiceId']
        
        # Rename columns for clarity
        customer_data = customer_data.rename(columns={
            'invoiceId': 'orderCount',
            'purchaseDate': 'lastPurchase'
        })
        
        # Sort by total spent and get top customers
        top_customers = customer_data.sort_values('totalPrice', ascending=False).head(10)
        
        # Convert to list of dictionaries
        result = top_customers.to_dict(orient='records')
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

from flask import Markup

@app.route('/get_dashboard_interpretation', methods=['POST'])
def get_dashboard_interpretation():
    """
    Generate markdown interpretation text based on dashboard data analysis
    """
    try:
        data = request.json
        df = pd.DataFrame(data)
        
        # Basic analysis examples
        total_revenue = df['totalPrice'].sum()
        top_category = df.groupby('productCategory')['totalPrice'].sum().idxmax()
        avg_discount = df['discount'].mean() * 100
        
        # Top 3 days with highest sales
        sales_by_day = df.groupby('purchaseDate')['totalPrice'].sum().sort_values(ascending=False).head(3)
        top_days_list = "\n".join([f"  - {day}: AED{value:,.2f}" for day, value in sales_by_day.items()])
        
        # Order with highest value
        order_values = df.groupby('invoiceId')['totalPrice'].sum()
        max_order_id = order_values.idxmax()
        max_order_value = order_values.max()
        
        # 3 Best seller products from product performance
        product_performance = df.groupby('productPurchased').agg({
            'quantity': 'sum',
            'totalPrice': 'sum'
        }).sort_values('quantity', ascending=False).head(3)
        best_sellers_list = "\n".join([f"  - {row.name}: {row['quantity']} units, AED{row['totalPrice']:,.2f}" for _, row in product_performance.iterrows()])
        
        markdown_text = f"""
# Dashboard Interpretation

- Total Revenue: AED{total_revenue:,.2f}
- Top Product Category by Revenue: {top_category}
- Average Discount Rate: {avg_discount:.2f}%

## Top 3 Days with Highest Sales
{top_days_list}

## Order with Highest Value
- Order ID: {max_order_id}
- Order Value: AED {max_order_value:,.2f}

## 3 Best Seller Products
{best_sellers_list}

This dashboard provides insights into sales performance, order distribution, discount impact, and product performance.
"""
        return jsonify({'markdown': markdown_text})
    except Exception as e:
        print("Error in get_dashboard_interpretation:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
