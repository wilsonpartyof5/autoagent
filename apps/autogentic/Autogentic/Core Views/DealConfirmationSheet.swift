import SwiftUI

struct DealConfirmationSheet: View {
  let deal: Deal?
  let onDismiss: () -> Void
  
  var body: some View {
    VStack(spacing: 24) {
      Spacer()
      
      // Success icon
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 72))
        .foregroundStyle(Color.green)
      
      Text("Deal Started!")
        .font(.system(size: 28, weight: .bold))
        .foregroundStyle(.white)
      
      if let deal = deal {
        VStack(spacing: 8) {
          Text(deal.vehicle.fullTitle)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
          
          Text(deal.vehicle.formattedPrice)
            .font(.system(size: 16))
            .foregroundStyle(Color.white.opacity(0.7))
        }
        .padding(.horizontal, 32)
      }
      
      VStack(spacing: 12) {
        Text("What happens next?")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
        
        VStack(alignment: .leading, spacing: 16) {
          stepRow(number: 1, text: "Drevvy contacts the seller privately")
          stepRow(number: 2, text: "We negotiate the best out-the-door price")
          stepRow(number: 3, text: "You'll receive a quote to review")
        }
        .padding(.horizontal, 32)
      }
      .padding(.top, 8)
      
      Spacer()
      
      Button {
        onDismiss()
      } label: {
        Text("Got it")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.black)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 16)
          .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
              .fill(.white)
          )
      }
      .padding(.horizontal, 24)
      .padding(.bottom, 32)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.ignoresSafeArea())
    .preferredColorScheme(.dark)
  }
  
  private func stepRow(number: Int, text: String) -> some View {
    HStack(alignment: .top, spacing: 12) {
      Text("\(number)")
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(.black)
        .frame(width: 24, height: 24)
        .background(Circle().fill(.white))
      
      Text(text)
        .font(.system(size: 15))
        .foregroundStyle(Color.white.opacity(0.8))
      
      Spacer()
    }
  }
}
