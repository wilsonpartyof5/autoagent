import SwiftUI

struct PaywallSheet: View {
  @EnvironmentObject private var subscription: SubscriptionStore
  @Environment(\.dismiss) private var dismiss
  
  let onSubscribe: () -> Void
  
  var body: some View {
    VStack(spacing: 24) {
      Spacer()
      
      // Hero
      Image(systemName: "person.badge.key.fill")
        .font(.system(size: 64))
        .foregroundStyle(
          LinearGradient(
            colors: [.orange, .yellow],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
      
      Text("Unlock Your Agent")
        .font(.system(size: 28, weight: .bold))
        .foregroundStyle(.white)
      
      Text("$\(SubscriptionStore.pricePerMonth)/month")
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.9))
      
      // Benefits
      VStack(alignment: .leading, spacing: 16) {
        benefitRow(icon: "car.2.fill", text: "Track up to 10 vehicles at once")
        benefitRow(icon: "phone.arrow.up.right.fill", text: "AI agent negotiates on your behalf")
        benefitRow(icon: "dollarsign.circle.fill", text: "Get the best out-the-door price")
        benefitRow(icon: "clock.fill", text: "Real-time progress updates")
        benefitRow(icon: "xmark.shield.fill", text: "No dealer calls to you")
      }
      .padding(.horizontal, 32)
      .padding(.vertical, 16)
      
      Spacer()
      
      // CTA
      VStack(spacing: 12) {
        Button {
          // Mock subscribe for dev
          Task {
            let success = await subscription.purchase()
            if success {
              onSubscribe()
              dismiss()
            }
          }
        } label: {
          Text("Start Subscription")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
              RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.white)
            )
        }
        
        Button {
          dismiss()
        } label: {
          Text("Maybe Later")
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.7))
        }
        
        Text("Cancel anytime. No commitment.")
          .font(.system(size: 12))
          .foregroundStyle(Color.white.opacity(0.5))
      }
      .padding(.horizontal, 24)
      .padding(.bottom, 32)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.ignoresSafeArea())
    .preferredColorScheme(.dark)
  }
  
  private func benefitRow(icon: String, text: String) -> some View {
    HStack(spacing: 14) {
      Image(systemName: icon)
        .font(.system(size: 20))
        .foregroundStyle(.orange)
        .frame(width: 28)
      
      Text(text)
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.9))
      
      Spacer()
    }
  }
}

struct AgentLimitSheet: View {
  @Environment(\.dismiss) private var dismiss
  
  var body: some View {
    VStack(spacing: 24) {
      Spacer()
      
      Image(systemName: "exclamationmark.triangle.fill")
        .font(.system(size: 56))
        .foregroundStyle(.orange)
      
      Text("Agent at Capacity")
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)
      
      Text("Your agent is tracking \(SubscriptionStore.dealsPerAgent) vehicles — the maximum for one subscription.")
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.7))
        .multilineTextAlignment(.center)
        .padding(.horizontal, 32)
      
      VStack(spacing: 8) {
        Text("Need more?")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
        
        Text("Add another agent for $\(SubscriptionStore.pricePerMonth)/mo to track 10 more vehicles.")
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.6))
          .multilineTextAlignment(.center)
          .padding(.horizontal, 32)
      }
      .padding(.top, 8)
      
      Spacer()
      
      VStack(spacing: 12) {
        Button {
          // TODO: Wire to add another agent purchase
          dismiss()
        } label: {
          Text("Add Another Agent")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
              RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.white)
            )
        }
        
        Button {
          dismiss()
        } label: {
          Text("Not Now")
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.7))
        }
      }
      .padding(.horizontal, 24)
      .padding(.bottom, 32)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.ignoresSafeArea())
    .preferredColorScheme(.dark)
  }
}
