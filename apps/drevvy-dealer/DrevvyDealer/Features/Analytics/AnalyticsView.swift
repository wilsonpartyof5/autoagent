import Charts
import SwiftUI

struct AnalyticsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var range = AnalyticsRange.week

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Picker("Date range", selection: $range) {
                        ForEach(AnalyticsRange.allCases) { range in
                            Text(range.title).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)

                    if let dashboard = store.dashboard {
                        leadChart(dashboard.trends)
                        metricList(dashboard.metrics)
                    } else {
                        ContentUnavailableView(
                            "No analytics yet",
                            systemImage: "chart.xyaxis.line",
                            description: Text("Pull down to try again.")
                        )
                    }
                }
                .padding()
            }
            .background(DrevvyColor.canvas)
            .navigationTitle("Analytics")
            .refreshable { await store.refresh() }
        }
    }

    private func leadChart(_ trends: [TrendPoint]) -> some View {
        DrevvyCard {
            Text("Lead activity")
                .font(.headline)
            Text(range.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)

            Chart(trends) { point in
                AreaMark(
                    x: .value("Day", point.date),
                    y: .value("Leads", point.leads)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [DrevvyColor.brand.opacity(0.35), DrevvyColor.brand.opacity(0.02)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                LineMark(
                    x: .value("Day", point.date),
                    y: .value("Leads", point.leads)
                )
                .foregroundStyle(DrevvyColor.brand)
                .interpolationMethod(.catmullRom)
                PointMark(
                    x: .value("Day", point.date),
                    y: .value("Leads", point.leads)
                )
                .foregroundStyle(DrevvyColor.brand)
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { _ in
                    AxisValueLabel(format: .dateTime.weekday(.narrow))
                    AxisGridLine()
                }
            }
            .frame(height: 220)
            .padding(.top, 12)
        }
    }

    private func metricList(_ metrics: [DashboardMetric]) -> some View {
        VStack(spacing: 12) {
            SectionTitle(title: "Performance")
            ForEach(metrics) { metric in
                DrevvyCard {
                    HStack {
                        Image(systemName: metric.symbol)
                            .font(.title3)
                            .foregroundStyle(DrevvyColor.brand)
                            .frame(width: 42, height: 42)
                            .background(DrevvyColor.brand.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(metric.title)
                                .font(.subheadline.weight(.semibold))
                            Text(metric.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(metric.value)
                            .font(.title2.weight(.bold))
                    }
                }
            }
        }
    }
}

private enum AnalyticsRange: String, CaseIterable, Identifiable {
    case week
    case month
    case quarter

    var id: String { rawValue }

    var title: String {
        switch self {
        case .week: "7 days"
        case .month: "30 days"
        case .quarter: "90 days"
        }
    }

    var subtitle: String {
        switch self {
        case .week: "Leads received over the last 7 days"
        case .month: "Leads received over the last 30 days"
        case .quarter: "Leads received over the last 90 days"
        }
    }
}

#Preview {
    AnalyticsView()
        .environmentObject(AppStore())
}
