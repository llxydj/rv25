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
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#d1d5db",
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
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#d1d5db",
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
  },
  emptyState: {
    padding: 20,
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#fbbf24"
  },
  emptyStateText: {
    fontSize: 12,
    color: "#92400e",
    textAlign: "center"
  }
})

interface YearlyReportDocumentProps {
  yearData: any
  year: number
  templateNotes?: string
}

export default function YearlyReportDocument({ yearData, year, templateNotes = "" }: YearlyReportDocumentProps) {
  
  const typeBreakdown = yearData?.type_breakdown || {}
  const statusSummary = yearData?.status_summary || {}
  const quarters = yearData?.quarters || []
  const reports = yearData?.reports || []
  const totalIncidents = yearData?.total_incidents || 0

  const topIncidentTypes = Object.entries(typeBreakdown)
    .map(([type, count]) => ({ type, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const statusDistribution = Object.entries(statusSummary)
    .map(([status, count]) => ({ status, count: count as number }))

  const busiestQuarter = quarters.length > 0
    ? quarters.reduce((max: any, quarter: any) => 
        (quarter?.incident_count || 0) > (max?.incident_count || 0) ? quarter : max, 
        quarters[0]
      )?.quarter
    : "N/A"

  const mostCommonType = topIncidentTypes.length > 0 ? topIncidentTypes[0].type : "N/A"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* HEADER WITH CLOUDINARY LOGO */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              src="https://res.cloudinary.com/dfrzg0mbh/image/upload/radiant-logo_i7zwcd"
              style={styles.logo}
            />
            <View style={styles.headerText}>
              <Text style={styles.title}>Annual Report {year}</Text>
              <Text style={styles.orgName}>Radiant Rescue Volunteers Inc.</Text>
            </View>
          </View>

          <View>
            <Text style={styles.date}>
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={styles.date}>Fiscal Year: {year}</Text>
          </View>
        </View>

        {/* EMPTY STATE – NO DATA */}
        {totalIncidents === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No incident data available for {year}. This report cannot be generated.
            </Text>
          </View>
        ) : (
          <>
            {/* EXECUTIVE SUMMARY */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Executive Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Incidents:</Text>
                <Text style={styles.summaryValue}>{totalIncidents}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reports Generated:</Text>
                <Text style={styles.summaryValue}>{reports.length}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Busiest Quarter:</Text>
                <Text style={styles.summaryValue}>{busiestQuarter}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Most Common Incident Type:</Text>
                <Text style={styles.summaryValue}>{mostCommonType}</Text>
              </View>

              {templateNotes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Executive Summary Notes</Text>
                  <Text style={styles.notesText}>{templateNotes}</Text>
                </View>
              )}
            </View>

            {/* QUARTERLY BREAKDOWN */}
            {quarters.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quarterly Breakdown</Text>

                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Quarter</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Incident Count</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Start Date</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>End Date</Text></View>
                  </View>

                  {quarters.map((q: any, i: number) => (
                    <View key={q?.quarter || i} style={styles.tableRow}>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{q?.quarter || "N/A"}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{q?.incident_count || 0}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{q?.start ? new Date(q.start).toLocaleDateString("en-US") : "N/A"}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{q?.end ? new Date(q.end).toLocaleDateString("en-US") : "N/A"}</Text></View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* INCIDENT TYPES */}
            {topIncidentTypes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Incident Types</Text>

                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Incident Type</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Count</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Percentage</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Chart</Text></View>
                  </View>

                  {topIncidentTypes.map((item) => (
                    <View key={item.type} style={styles.tableRow}>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{item.type}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{item.count}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{((item.count / totalIncidents) * 100).toFixed(1)}%</Text></View>
                      <View style={styles.tableCol}>
                        <View style={styles.chartPlaceholder}>
                          <Text style={styles.chartPlaceholderText}>Chart Visualization</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* STATUS DISTRIBUTION */}
            {statusDistribution.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Status Distribution</Text>

                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Status</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Count</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Percentage</Text></View>
                    <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Chart</Text></View>
                  </View>

                  {statusDistribution.map((item) => (
                    <View key={item.status} style={styles.tableRow}>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{item.status}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{item.count}</Text></View>
                      <View style={styles.tableCol}><Text style={styles.tableCell}>{((item.count / totalIncidents) * 100).toFixed(1)}%</Text></View>
                      <View style={styles.tableCol}>
                        <View style={styles.chartPlaceholder}>
                          <Text style={styles.chartPlaceholderText}>Chart Visualization</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Radiant Rescue Volunteers Inc. - Annual Report {year}
          </Text>

          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </View>

      </Page>
    </Document>
  )
}
