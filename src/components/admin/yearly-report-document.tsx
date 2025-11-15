import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer"

// Register fonts
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf", fontWeight: 300 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf", fontWeight: 400 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf", fontWeight: 500 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf", fontWeight: 700 },
  ]
})

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Roboto"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#000"
  },
  logo: {
    width: 50,
    height: 50,
  },
  headerText: {
    flex: 1,
    paddingLeft: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2563eb"
  },
  orgName: {
    fontSize: 16,
    fontWeight: "medium",
    color: "#374151"
  },
  date: {
    fontSize: 12,
    color: "#6b7280"
  },
  section: {
    marginVertical: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937"
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "medium",
    color: "#374151"
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "normal",
    color: "#111827"
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginBottom: 10
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row"
  },
  tableColHeader: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#f3f4f6"
  },
  tableCol: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0
  },
  tableCellHeader: {
    margin: "auto",
    marginTop: 5,
    marginBottom: 5,
    fontSize: 10,
    fontWeight: "bold"
  },
  tableCell: {
    margin: "auto",
    marginTop: 5,
    marginBottom: 5,
    fontSize: 9
  },
  chartPlaceholder: {
    height: 150,
    backgroundColor: "#f9fafb",
    border: "1px dashed #d1d5db",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10
  },
  chartPlaceholderText: {
    fontSize: 12,
    color: "#6b7280"
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 10
  },
  footerText: {
    fontSize: 10,
    color: "#6b7280"
  },
  notesSection: {
    marginVertical: 10,
    padding: 10,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    backgroundColor: "#f9fafb"
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1f2937"
  },
  notesText: {
    fontSize: 12,
    color: "#374151"
  }
})

interface YearlyReportDocumentProps {
  yearData: any
  year: number
  templateNotes?: string
}

export default function YearlyReportDocument({ yearData, year, templateNotes = "" }: YearlyReportDocumentProps) {
  // Get top 5 incident types for the table
  const topIncidentTypes = Object.entries(yearData.type_breakdown)
    .map(([type, count]) => ({ type, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Get status distribution for the table
  const statusDistribution = Object.entries(yearData.status_summary)
    .map(([status, count]) => ({ status, count: count as number }))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image src="/assets/radiant-logo.png" style={styles.logo} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Annual Report</Text>
              <Text style={styles.orgName}>Radiant Rescue Volunteers Inc.</Text>
            </View>
          </View>
          <View>
            <Text style={styles.date}>Generated on: {new Date().toLocaleDateString()}</Text>
            <Text style={styles.date}>Year: {year}</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Incidents:</Text>
            <Text style={styles.summaryValue}>{yearData.total_incidents}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reports Generated:</Text>
            <Text style={styles.summaryValue}>{yearData.reports.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Busiest Quarter:</Text>
            <Text style={styles.summaryValue}>
              {yearData.quarters.reduce((max: any, quarter: any) => 
                quarter.incident_count > max.incident_count ? quarter : max, 
                yearData.quarters[0]
              )?.quarter}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Most Common Incident Type:</Text>
            <Text style={styles.summaryValue}>
              {Object.entries(yearData.type_breakdown)
                .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || "N/A"}
            </Text>
          </View>
          
          {/* Template Notes Section */}
          {templateNotes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>Executive Summary Notes</Text>
              <Text style={styles.notesText}>{templateNotes}</Text>
            </View>
          )}
        </View>

        {/* Quarterly Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quarterly Breakdown</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Quarter</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Incident Count</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Start Date</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>End Date</Text>
              </View>
            </View>
            {yearData.quarters.map((quarter: any) => (
              <View key={quarter.quarter} style={styles.tableRow}>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{quarter.quarter}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{quarter.incident_count}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {new Date(quarter.start).toLocaleDateString('en-US')}
                  </Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {new Date(quarter.end).toLocaleDateString('en-US')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Incident Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Incident Types</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Incident Type</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Count</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Percentage</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Chart</Text>
              </View>
            </View>
            {topIncidentTypes.map((item) => (
              <View key={item.type} style={styles.tableRow}>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{item.type}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{item.count}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {((item.count / yearData.total_incidents) * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.chartPlaceholder}>
                    <Text style={styles.chartPlaceholderText}>Chart Visualization</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Status Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Distribution</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Status</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Count</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Percentage</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Chart</Text>
              </View>
            </View>
            {statusDistribution.map((item) => (
              <View key={item.status} style={styles.tableRow}>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{item.status}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{item.count}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {((item.count / yearData.total_incidents) * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.chartPlaceholder}>
                    <Text style={styles.chartPlaceholderText}>Chart Visualization</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Radiant Rescue Volunteers Inc. - Annual Report {year}
          </Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => (
            `Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </View>
      </Page>
    </Document>
  )
}