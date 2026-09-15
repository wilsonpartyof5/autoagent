import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var store: AppStore
    @AppStorage("newLeadNotifications") private var newLeadNotifications = true
    @AppStorage("balanceNotifications") private var balanceNotifications = true

    var body: some View {
        NavigationStack {
            List {
                Section("Active dealership") {
                    if store.dealerships.isEmpty {
                        Text("No dealership available")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Dealership", selection: dealershipBinding) {
                            ForEach(store.dealerships) { dealership in
                                VStack(alignment: .leading) {
                                    Text(dealership.name)
                                    Text(dealership.location)
                                }
                                .tag(dealership.id)
                            }
                        }
                    }
                }

                Section {
                    if let balance = store.dashboard?.balance {
                        LabeledContent("Cash balance", value: balance.cashBalance.currencyText)
                        LabeledContent("Included leads", value: "\(balance.includedLeadsRemaining)")
                        LabeledContent("Total leads available", value: "\(balance.totalLeadsAvailable)")
                        LabeledContent("Lead price", value: balance.leadPriceCents.currencyFromCents)
                        LabeledContent("Auto replenish", value: balance.autoReplenishEnabled ? "On" : "Off")
                    }

                    Link(destination: billingURL) {
                        Label("Manage billing on website", systemImage: "safari")
                    }
                } header: {
                    Text("Lead balance")
                } footer: {
                    Text("For safety, money can only be added or managed on the dealership website.")
                }

                Section("Notifications") {
                    Toggle("New leads", isOn: $newLeadNotifications)
                    Toggle("Low balance", isOn: $balanceNotifications)
                }

                Section("Account") {
                    LabeledContent("Signed in as", value: "Demo dealer")
                    Button("Sign out", role: .destructive) {}
                        .disabled(true)
                }

                Section {
                    HStack {
                        Spacer()
                        VStack(spacing: 4) {
                            Image(systemName: "car.side.fill")
                                .foregroundStyle(DrevvyColor.brand)
                            Text("Drevvy Dealer")
                                .font(.caption.weight(.semibold))
                            Text("Version 1.0")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            }
            .navigationTitle("Account")
        }
    }

    private var dealershipBinding: Binding<String> {
        Binding(
            get: { store.selectedDealership?.id ?? "" },
            set: { dealershipID in
                guard let dealership = store.dealerships.first(where: { $0.id == dealershipID }) else { return }
                Task { await store.select(dealership) }
            }
        )
    }

    private var billingURL: URL {
        URL(string: "https://autoagent-dealer-dashboard.vercel.app/app/billing")!
    }
}

#Preview {
    AccountView()
        .environmentObject(AppStore())
}
