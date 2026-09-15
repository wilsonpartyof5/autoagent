import SwiftUI

enum DrevvyColor {
    static let brand = Color(red: 0.16, green: 0.42, blue: 0.96)
    static let cyan = Color(red: 0.18, green: 0.76, blue: 0.91)
    static let positive = Color(red: 0.12, green: 0.67, blue: 0.46)
    static let warning = Color(red: 0.96, green: 0.62, blue: 0.14)
    static let danger = Color(red: 0.93, green: 0.30, blue: 0.34)
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}

struct DrevvyCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DrevvyColor.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(.primary.opacity(0.06), lineWidth: 1)
            }
    }
}

struct SectionTitle: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack {
            Text(title)
                .font(.title3.weight(.bold))
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.subheadline.weight(.semibold))
            }
        }
    }
}

extension LeadStatus {
    var color: Color {
        switch self {
        case .new: DrevvyColor.brand
        case .contacted: DrevvyColor.cyan
        case .qualified: DrevvyColor.positive
        case .testDriveBooked: DrevvyColor.warning
        case .closed: .secondary
        }
    }
}

extension DeliveryState {
    var color: Color {
        switch self {
        case .pending: DrevvyColor.warning
        case .delivered: DrevvyColor.positive
        case .failed: DrevvyColor.danger
        }
    }
}

extension Decimal {
    var currencyText: String {
        formatted(.currency(code: "USD").precision(.fractionLength(0)))
    }
}

extension Int {
    var currencyFromCents: String {
        (Decimal(self) / 100).currencyText
    }
}
