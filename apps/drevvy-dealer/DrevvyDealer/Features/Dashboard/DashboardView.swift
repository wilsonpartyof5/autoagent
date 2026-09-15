import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 18) {
                    header

                    if let dashboard = store.dashboard {
                        BalanceCard(balance: dashboard.balance)
                        metricsGrid(dashboard.metrics)
                    }

                    recentLeads
                }
                .padding()
            }
            .background(DrevvyColor.canvas)
            .navigationTitle("Overview")
            .refreshable { await store.refresh() }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [DrevvyColor.brand, DrevvyColor.cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Image(systemName: "building.2.crop.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
            }
            .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 3) {
                Text("Good morning")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(store.selectedDealership?.name ?? "Your dealership")
                    .font(.headline)
                    .lineLimit(1)
                if let location = store.selectedDealership?.location {
                    Text(location)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button {
                Task { await store.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.headline)
                    .frame(width: 42, height: 42)
                    .background(.thinMaterial, in: Circle())
            }
            .accessibilityLabel("Refresh dashboard")
        }
    }

    private func metricsGrid(_ metrics: [DashboardMetric]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(metrics) { metric in
                DrevvyCard {
                    Image(systemName: metric.symbol)
                        .font(.headline)
                        .foregroundStyle(DrevvyColor.brand)
                    Text(metric.value)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .padding(.top, 8)
                    Text(metric.title)
                        .font(.subheadline.weight(.semibold))
                    Text(metric.detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.top, 1)
                }
            }
        }
    }

    private var recentLeads: some View {
        VStack(spacing: 12) {
            SectionTitle(title: "Recent leads")
            if store.leads.isEmpty {
                ContentUnavailableView(
                    "No leads yet",
                    systemImage: "person.crop.circle.badge.questionmark",
                    description: Text("New leads will appear here.")
                )
            } else {
                ForEach(store.leads.prefix(3)) { lead in
                    NavigationLink {
                        LeadDetailView(leadID: lead.id)
                    } label: {
                        LeadRow(lead: lead)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct BalanceCard: View {
    let balance: BalanceSummary

    var body: some View {
        DrevvyCard {
            Label("Lead balance", systemImage: "creditcard.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            Text("\(balance.totalLeadsAvailable)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .padding(.top, 8)
            Text("leads available")
                .font(.title3.weight(.semibold))

            Text(balanceMessage)
                .font(.subheadline)
                .foregroundStyle(balance.isLow ? DrevvyColor.danger : .secondary)
                .padding(.top, 5)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Current balance")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(balance.cashBalance.currencyText)
                        .font(.title3.weight(.bold))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Price per lead")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(balance.leadPriceCents.currencyFromCents)
                        .font(.title3.weight(.bold))
                }
            }
            .padding(.top, 16)

            Divider().padding(.vertical, 10)

            HStack {
                Label(
                    balance.autoReplenishEnabled ? "Auto replenish is on" : "Auto replenish is off",
                    systemImage: balance.autoReplenishEnabled ? "arrow.triangle.2.circlepath.circle.fill" : "pause.circle.fill"
                )
                .font(.caption.weight(.semibold))
                Spacer()
                Link(destination: billingURL) {
                    Label("Open dashboard", systemImage: "arrow.up.right")
                        .font(.caption.weight(.semibold))
                }
            }
        }
    }

    private var balanceMessage: String {
        if balance.totalLeadsAvailable == 0 {
            return "Replenish on the dealer dashboard to receive new leads."
        }
        if balance.isLow {
            return "Replenish soon so new leads are not held."
        }
        if balance.includedLeadsRemaining > 0 {
            return "Your next \(balance.includedLeadsRemaining) leads are included at no charge."
        }
        return "You are covered for \(balance.paidLeadsAvailable) more leads."
    }

    private var billingURL: URL {
        URL(string: "https://autoagent-dealer-dashboard.vercel.app/app/billing")!
    }
}

#Preview {
    DashboardView()
        .environmentObject(AppStore())
}
