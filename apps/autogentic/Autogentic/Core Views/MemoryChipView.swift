import SwiftUI

struct MemoryChipView: View {
  let memoryItems: [MemoryItem]
  @State private var showSheet: Bool = false
  
  var body: some View {
    if !memoryItems.isEmpty {
      Button {
        showSheet = true
      } label: {
        HStack(spacing: 6) {
          Image(systemName: "clock.arrow.circlepath")
            .font(.system(size: 13))
          Text("Using your past searches")
            .font(.system(size: 14, weight: .medium))
        }
        .foregroundStyle(Color(red: 0.45, green: 0.45, blue: 0.75))
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
          Capsule()
            .fill(Color(red: 0.85, green: 0.85, blue: 0.95).opacity(0.15))
        )
      }
      .frame(height: 44)
      .sheet(isPresented: $showSheet) {
        MemorySheet(memoryItems: memoryItems, isPresented: $showSheet)
          .presentationDetents([.medium])
          .presentationDragIndicator(.visible)
      }
    }
  }
}

struct MemorySheet: View {
  let memoryItems: [MemoryItem]
  @Binding var isPresented: Bool
  @State private var excludedItems: Set<String> = []
  
  var body: some View {
    NavigationView {
      VStack(alignment: .leading, spacing: 0) {
        Text("Memory items used in this answer")
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.6))
          .padding(.horizontal, 20)
          .padding(.top, 8)
          .padding(.bottom, 16)
        
        ScrollView {
          LazyVStack(spacing: 0) {
            ForEach(memoryItems) { item in
              MemoryItemRow(
                item: item,
                isExcluded: excludedItems.contains(item.id),
                onToggle: {
                  if excludedItems.contains(item.id) {
                    excludedItems.remove(item.id)
                  } else {
                    excludedItems.insert(item.id)
                  }
                }
              )
            }
          }
        }
        
        Spacer()
        
        HStack(spacing: 12) {
          Button {
            // Navigate to Profile > Search Profile
            isPresented = false
          } label: {
            Text("Edit in Profile")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(.white)
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
              .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                  .stroke(Color.white.opacity(0.3), lineWidth: 1)
              )
          }
          
          Button {
            isPresented = false
          } label: {
            Text("Done")
              .font(.system(size: 16, weight: .semibold))
              .foregroundStyle(.black)
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
              .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                  .fill(.white)
              )
          }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
      }
      .background(Color(white: 0.1).ignoresSafeArea())
      .navigationTitle("Past searches")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarBackground(Color(white: 0.1), for: .navigationBar)
      .toolbarBackground(.visible, for: .navigationBar)
      .preferredColorScheme(.dark)
    }
  }
}

struct MemoryItemRow: View {
  let item: MemoryItem
  let isExcluded: Bool
  let onToggle: () -> Void
  
  var body: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 4) {
        Text(item.kind.rawValue)
          .font(.system(size: 13))
          .foregroundStyle(Color.white.opacity(0.5))
        Text(item.value)
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(.white)
      }
      
      Spacer()
      
      Toggle("", isOn: .constant(!isExcluded))
        .labelsHidden()
        .tint(Color(red: 0.45, green: 0.45, blue: 0.85))
        .onTapGesture {
          onToggle()
        }
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 14)
    .background(
      Rectangle()
        .fill(Color.white.opacity(0.04))
    )
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(Color.white.opacity(0.08))
        .frame(height: 1)
    }
  }
}
