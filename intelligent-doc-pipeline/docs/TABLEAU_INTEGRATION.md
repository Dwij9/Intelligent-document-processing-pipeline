# Tableau Integration Guide

Connect Tableau to the DocPipeline MongoDB to build executive-level dashboards, trend analyses, and audit reports beyond what the built-in React dashboard provides.

## Connection Setup

### Option A: MongoDB BI Connector (recommended)

The MongoDB BI Connector translates SQL queries into MongoDB aggregation pipelines, letting Tableau connect via its standard MySQL/ODBC driver.

1. **Install the BI Connector** on the same host as MongoDB (or a dedicated analytics node):

   ```bash
   # Download from https://www.mongodb.com/try/download/bi-connector
   mongosqld --mongo-uri "mongodb://mongo:27017/docpipeline" --addr 0.0.0.0:3307
   ```

2. **Connect from Tableau**:
   - Open Tableau Desktop → Connect → MySQL
   - Host: your BI Connector host
   - Port: 3307
   - Database: `docpipeline`
   - No authentication required for local dev; configure SSL for production

3. Tableau will see the collections as tables. The BI Connector flattens nested documents (like `extracted.*` and `anomaly.*`) into dot-notation columns.

### Option B: Tableau's Native MongoDB Connector

Available in Tableau 2023.3+ with the MongoDB ODBC driver.

1. Install the [MongoDB ODBC Driver](https://www.mongodb.com/docs/atlas/data-federation/query/sql/drivers/odbc/)
2. In Tableau: Connect → MongoDB → enter your connection string
3. This gives direct access without the BI Connector but may have performance implications on large collections.

### Option C: Export to CSV / JSON for one-off analysis

```bash
# Export completed documents to CSV
mongoexport --uri="mongodb://localhost:27017/docpipeline" \
  --collection=documents \
  --query='{"status":"completed"}' \
  --type=csv \
  --fields="extracted.vendor,extracted.total,extracted.date,anomaly.isAnomaly,anomaly.score" \
  --out=documents_export.csv
```

Then open the CSV directly in Tableau.

## Recommended Dashboards

### 1. Document Processing Overview

**Data source**: `documents` collection

| Measure / Dimension       | MongoDB field              | Tableau use                      |
|---------------------------|----------------------------|----------------------------------|
| Document count            | `_id` (count)              | KPI card                         |
| Processing status         | `status`                   | Status breakdown pie chart        |
| Upload date               | `createdAt`                | Time axis                        |
| Processing time           | `processingTimeMs`         | Avg processing time trend         |
| File type                 | `fileType`                 | Filter / color dimension          |

**Suggested layout**:
- Top row: KPI cards (total docs, completed %, avg processing time, failure rate)
- Middle: line chart of daily upload volume, colored by status
- Bottom: table of recent failed documents with error messages

### 2. Financial Analysis

**Data source**: `documents` collection (completed only)

| Measure / Dimension       | MongoDB field                 | Tableau use                  |
|---------------------------|-------------------------------|------------------------------|
| Vendor                    | `extracted.vendor`            | Dimension (bar chart axis)   |
| Invoice total             | `extracted.total`             | Measure (SUM, AVG)           |
| Invoice date              | `extracted.date`              | Time axis                    |
| Line item category        | `extracted.lineItems.category`| Dimension (requires unnest)  |
| Line item amount          | `extracted.lineItems.amount`  | Measure                      |
| GL code                   | `extracted.lineItems.glCode`  | Filter                       |

**Suggested layout**:
- Treemap of spend by vendor
- Stacked bar chart of spend by category over time
- Scatter plot of invoice total vs. number of line items (spot outliers)
- Monthly trend line with YoY comparison

### 3. Anomaly Audit Dashboard

**Data source**: `documents` collection (where `anomaly.isAnomaly = true`)

| Measure / Dimension       | MongoDB field              | Tableau use                    |
|---------------------------|----------------------------|--------------------------------|
| Anomaly score             | `anomaly.score`            | Measure (histogram, heatmap)   |
| Anomaly reasons           | `anomaly.reasons`          | Dimension (requires unnest)    |
| Vendor                    | `extracted.vendor`         | Dimension                      |
| Total                     | `extracted.total`          | Measure                        |
| Detection date            | `anomaly.detectedAt`       | Time axis                      |

**Suggested layout**:
- Anomaly rate over time (% of processed docs flagged)
- Horizontal bar chart of anomaly reasons by frequency
- Heatmap: vendor × anomaly reason
- Detail table with drill-down into individual flagged documents

### 4. Knowledge Base Coverage

**Data sources**: `documents` + `knowledge_base` collections

Cross-reference match results to show KB health:
- Pie chart: exact vs. semantic vs. fuzzy vs. unmatched
- Bar chart: match confidence distribution
- Table of unmatched vendors (candidates for KB expansion)

## Calculated Fields

Some useful Tableau calculated fields for this dataset:

```
// Anomaly rate
SUM(IF [anomaly.isAnomaly] = true THEN 1 ELSE 0 END) / COUNT([_id])

// Tax ratio
[extracted.tax] / [extracted.total]

// Processing time in seconds
[processingTimeMs] / 1000

// Days until due
DATEDIFF('day', [extracted.date], [extracted.dueDate])

// Is overdue
IF [extracted.dueDate] < TODAY() AND [status] = 'completed' THEN "Overdue" ELSE "Current" END
```

## Refresh Schedule

For production, set up Tableau Server or Tableau Cloud with a data extract refresh:

- **Full extract**: nightly at 2 AM (rebuilds the entire dataset)
- **Incremental extract**: every 4 hours, filtering on `updatedAt > last_refresh`

Configure in Tableau Server: Schedules → New Schedule → select the MongoDB data source.

## Performance Tips

- Create MongoDB indexes on frequently filtered fields:
  ```javascript
  db.documents.createIndex({ "extracted.vendor": 1 });
  db.documents.createIndex({ "anomaly.isAnomaly": 1 });
  db.documents.createIndex({ createdAt: -1 });
  db.documents.createIndex({ status: 1 });
  ```
- Use Tableau extracts (`.hyper`) instead of live connections for large datasets
- Filter server-side: use Custom SQL or Initial SQL filters to limit rows before they reach Tableau
- For line items analysis, create a MongoDB view that unwinds the `lineItems` array:
  ```javascript
  db.createView("documents_line_items", "documents", [
    { $match: { status: "completed" } },
    { $unwind: "$extracted.lineItems" },
    { $project: {
      vendor: "$extracted.vendor",
      date: "$extracted.date",
      description: "$extracted.lineItems.description",
      amount: "$extracted.lineItems.amount",
      category: "$extracted.lineItems.category",
      glCode: "$extracted.lineItems.glCode",
      isAnomaly: "$anomaly.isAnomaly"
    }}
  ]);
  ```
