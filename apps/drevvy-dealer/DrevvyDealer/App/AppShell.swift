import SwiftUI

struct AppShell: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var notificationRouter: NotificationRouter
    @State private var selectedTab = AppTab.overview

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem { Label("Overview", systemImage: "rectangle.grid.2x2.fill") }
                .tag(AppTab.overview)

            LeadsView()
                .tabItem { Label("Leads", systemImage: "person.2.fill") }
                .badge(newLeadCount)
                .tag(AppTab.leads)

            AnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.xyaxis.line") }
                .tag(AppTab.analytics)

            InventoryView()
                .tabItem { Label("Inventory", systemImage: "car.2.fill") }
                .tag(AppTab.inventory)

            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle.fill") }
                .tag(AppTab.account)
        }
        .tint(DrevvyColor.brand)
        .task {
            await store.load()
            await NotificationManager.shared.requestAuthorization()
        }
        .onChange(of: notificationRouter.pendingLeadID) { _, leadID in
            guard let leadID else { return }
            selectedTab = .leads
            store.selectedLeadID = leadID
            notificationRouter.pendingLeadID = nil
        }
        .onChange(of: notificationRouter.deviceToken) { _, token in
            guard let token else { return }
            Task { await store.registerDeviceToken(token) }
        }
        .overlay {
            if store.isLoading && store.dashboard == nil {
                ProgressView("Loading dealership…")
                    .padding(24)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
            }
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
    }

    private var newLeadCount: Int {
        store.leads.filter { $0.status == .new }.count
    }
}

private enum AppTab: Hashable {
    case overview
    case leads
    case analytics
    case inventory
    case account
}
