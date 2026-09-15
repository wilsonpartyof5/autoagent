import SwiftUI

struct LeadsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var searchText = ""
    @State private var statusFilter: LeadStatus?
    @State private var path: [String] = []

    private var filteredLeads: [DealerLead] {
        store.leads.filter { lead in
            let matchesStatus = statusFilter == nil || lead.status == statusFilter
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesSearch = query.isEmpty
                || lead.customer.name.localizedCaseInsensitiveContains(query)
                || lead.vehicle.title.localizedCaseInsensitiveContains(query)
                || (lead.vehicle.vin?.localizedCaseInsensitiveContains(query) ?? false)
            return matchesStatus && matchesSearch
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if filteredLeads.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    List(filteredLeads) { lead in
                        NavigationLink {
                            LeadDetailView(leadID: lead.id)
                        } label: {
                            LeadRow(lead: lead)
                                .padding(.vertical, 5)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await store.refresh() }
                }
            }
            .navigationTitle("Leads")
            .searchable(text: $searchText, prompt: "Name, vehicle, or VIN")
            .navigationDestination(for: String.self) { leadID in
                LeadDetailView(leadID: leadID)
            }
            .onChange(of: store.selectedLeadID) { _, leadID in
                guard let leadID, store.lead(id: leadID) != nil else { return }
                path = [leadID]
                store.selectedLeadID = nil
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("All leads") { statusFilter = nil }
                        Divider()
                        ForEach(LeadStatus.allCases) { status in
                            Button {
                                statusFilter = status
                            } label: {
                                if statusFilter == status {
                                    Label(status.title, systemImage: "checkmark")
                                } else {
                                    Text(status.title)
                                }
                            }
                        }
                    } label: {
                        Image(systemName: statusFilter == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                    .accessibilityLabel("Filter leads")
                }
            }
        }
    }
}

struct LeadRow: View {
    let lead: DealerLead

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(lead.status.color.opacity(0.13))
                Text(initials)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(lead.status.color)
            }
            .frame(width: 46, height: 46)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(lead.customer.name)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer()
                    Text(lead.ageText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(lead.vehicle.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Image(systemName: lead.status.symbol)
                    Text(lead.status.title)
                    Circle()
                        .frame(width: 3, height: 3)
                    Text(lead.delivery.state.title)
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(lead.status.color)
            }
        }
    }

    private var initials: String {
        lead.customer.name
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
    }
}

#Preview {
    LeadsView()
        .environmentObject(AppStore())
}
