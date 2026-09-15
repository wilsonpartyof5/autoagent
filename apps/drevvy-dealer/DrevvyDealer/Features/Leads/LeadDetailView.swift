import SwiftUI

struct LeadDetailView: View {
    @EnvironmentObject private var store: AppStore
    let leadID: String
    @State private var showingResendConfirmation = false

    var body: some View {
        Group {
            if let lead = store.lead(id: leadID) {
                ScrollView {
                    VStack(spacing: 16) {
                        customerCard(lead)
                        vehicleCard(lead)
                        statusCard(lead)
                        deliveryCard(lead)
                    }
                    .padding()
                }
                .background(DrevvyColor.canvas)
                .navigationTitle("Lead details")
                .navigationBarTitleDisplayMode(.inline)
                .confirmationDialog(
                    "Resend this lead?",
                    isPresented: $showingResendConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Resend XML to \(lead.delivery.method)") {
                        Task { await store.resend(lead.id) }
                    }
                } message: {
                    Text("Drevvy will place a new delivery job in the queue.")
                }
            } else {
                ContentUnavailableView(
                    "Lead unavailable",
                    systemImage: "person.crop.circle.badge.exclamationmark",
                    description: Text("This lead may no longer be available for this dealership.")
                )
            }
        }
    }

    private func customerCard(_ lead: DealerLead) -> some View {
        DrevvyCard {
            Label("Customer", systemImage: "person.crop.circle.fill")
                .font(.headline)
                .foregroundStyle(DrevvyColor.brand)
            Text(lead.customer.name)
                .font(.title2.weight(.bold))
                .padding(.top, 8)

            VStack(spacing: 10) {
                ContactRow(symbol: "envelope.fill", title: lead.customer.email)
                if let phone = lead.customer.phone {
                    ContactRow(symbol: "phone.fill", title: phone)
                }
                if let preferredTime = lead.customer.preferredTime {
                    ContactRow(symbol: "clock.fill", title: preferredTime)
                }
            }
            .padding(.top, 8)

            HStack {
                if let phone = lead.customer.phone,
                   let url = URL(string: "tel:\(phone.filter(\.isNumber))") {
                    Link(destination: url) {
                        Label("Call", systemImage: "phone.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
                if let url = URL(string: "mailto:\(lead.customer.email)") {
                    Link(destination: url) {
                        Label("Email", systemImage: "envelope.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(.top, 10)
        }
    }

    private func vehicleCard(_ lead: DealerLead) -> some View {
        DrevvyCard {
            Label("Vehicle", systemImage: "car.fill")
                .font(.headline)
                .foregroundStyle(DrevvyColor.brand)
            Text(lead.vehicle.title)
                .font(.title3.weight(.bold))
                .padding(.top, 8)
            if let vin = lead.vehicle.vin {
                Text("VIN \(vin)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .padding(.top, 2)
            }
        }
    }

    private func statusCard(_ lead: DealerLead) -> some View {
        DrevvyCard {
            Label("Lead status", systemImage: lead.status.symbol)
                .font(.headline)
                .foregroundStyle(lead.status.color)
            Picker("Lead status", selection: statusBinding(for: lead)) {
                ForEach(LeadStatus.allCases) { status in
                    Text(status.title).tag(status)
                }
            }
            .pickerStyle(.menu)
            .padding(.top, 4)
        }
    }

    private func deliveryCard(_ lead: DealerLead) -> some View {
        DrevvyCard {
            HStack {
                Label("XML delivery", systemImage: "arrow.up.doc.fill")
                    .font(.headline)
                Spacer()
                Text(lead.delivery.state.title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(lead.delivery.state.color)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(lead.delivery.state.color.opacity(0.12), in: Capsule())
            }
            Text(lead.delivery.method)
                .font(.subheadline.weight(.semibold))
                .padding(.top, 10)
            if let date = lead.delivery.attemptedAt {
                Text("Last attempt \(date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let message = lead.delivery.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(lead.delivery.state == .failed ? DrevvyColor.danger : .secondary)
                    .padding(.top, 4)
            }

            Button {
                showingResendConfirmation = true
            } label: {
                Label("Resend XML lead", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.top, 10)
        }
    }

    private func statusBinding(for lead: DealerLead) -> Binding<LeadStatus> {
        Binding(
            get: { store.lead(id: lead.id)?.status ?? lead.status },
            set: { status in
                Task { await store.updateStatus(for: lead.id, to: status) }
            }
        )
    }
}

private struct ContactRow: View {
    let symbol: String
    let title: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .frame(width: 22)
                .foregroundStyle(.secondary)
            Text(title)
                .font(.subheadline)
                .textSelection(.enabled)
            Spacer()
        }
    }
}
