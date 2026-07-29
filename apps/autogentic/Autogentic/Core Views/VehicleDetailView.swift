import SwiftUI

struct VehicleDetailView: View {
  @Environment(\.dismiss) private var dismiss
  let vehicle: Vehicle
  var chatVM: ChatViewModel?
  @State private var currentImageIndex: Int = 0
  @State private var searchText: String = ""
  @State private var keyboardHeight: CGFloat = 0
  @State private var detail: VehicleDetailData? = nil
  @State private var isLoadingDetail: Bool = false
  @State private var detailError: String? = nil
  
  private var availableImages: [String] {
    // Prefer enriched photo list from detail endpoint (more photos)
    if let enrichedPhotos = detail?.photoUrls, !enrichedPhotos.isEmpty {
      return enrichedPhotos
    }

    var images: [String] = []
    if let primary = vehicle.primaryPhotoUrl { images.append(primary) }
    if let photoUrls = vehicle.photoUrls {
      for url in photoUrls where !images.contains(url) { images.append(url) }
    }
    if let thumbnail = vehicle.thumbnailUrl, !images.contains(thumbnail) { images.append(thumbnail) }
    return images
  }
  
  var body: some View {
    ZStack(alignment: .bottom) {
      ScrollView {
        VStack(alignment: .leading, spacing: 0) {
          heroImage
          
          VStack(alignment: .leading, spacing: 16) {
            aboveTheFold
            ctaButtons
            divider
            keyFeaturesGrid
            detailLoadingIndicator

            if detail != nil {
              divider
              enrichedSpecsSection
            }

            divider
            historyAndCondition

            if let comments = detail?.sellerComments, !comments.isEmpty {
              divider
              sellerCommentsSection
            }

            divider
            if detail != nil {
              enrichedDealerSection
            } else {
              dealerInfo
            }

            bottomCTA
          }
          .padding(.horizontal, 16)
          .padding(.bottom, 90 + (keyboardHeight > 0 ? keyboardHeight : 0)) // Space for input bar
        }
      }
      .background(Color.black.ignoresSafeArea())
      .preferredColorScheme(.dark)
      .onAppear {
        #if DEBUG
        print("📸 DEBUG: VehicleDetailView loaded with \(availableImages.count) images")
        if !availableImages.isEmpty {
          print("📸 DEBUG: First image URL: \(availableImages[0])")
        }
        FunnelLogger.shared.detailOpened(id: vehicle.id)
        #endif
        Task { await loadDetail() }
      }
      .overlay(alignment: .topTrailing) {
        Button {
          dismiss()
        } label: {
          Image(systemName: "xmark")
            .font(.system(size: 15, weight: .bold))
            .frame(width: 36, height: 36)
            .background(Circle().fill(Color.black.opacity(0.7)))
            .foregroundStyle(.white)
        }
        .padding(.top, 60)
        .padding(.trailing, 16)
        .zIndex(100)
      }
      
      // Input bar - always visible at bottom
      VStack {
        Spacer()
        InputBarView(
          text: $searchText,
          placeholder: "Find similar or search for something else...",
          onSend: {
            let query = searchText
            print("🔍 DEBUG: New search from detail view: \(query)")
            searchText = ""
            
            // Dismiss keyboard
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            
            // Trigger search through ChatViewModel if available
            if let chatVM = chatVM {
              // Close detail view
              dismiss()
              
              // Send the new query
              chatVM.send(text: query)
            } else {
              // No ChatViewModel - just dismiss
              dismiss()
            }
          }
        )
        .padding(.horizontal, 12)
        .padding(.bottom, keyboardHeight > 0 ? keyboardHeight : 12)
        .animation(.easeOut(duration: 0.22), value: keyboardHeight)
      }
    }
    .onReceive(Keyboard.heightPublisher) { height in
      keyboardHeight = height
    }
  }
  
  private var heroImage: some View {
    ZStack(alignment: .topLeading) {
      if availableImages.isEmpty {
        placeholderHero
      } else {
        TabView(selection: $currentImageIndex) {
          ForEach(Array(availableImages.enumerated()), id: \.offset) { index, imageUrl in
            if let url = URL(string: imageUrl) {
              AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                  ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.12))
                case .success(let image):
                  image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(maxWidth: .infinity)
                    .frame(height: 340)
                    .clipped()
                case .failure:
                  placeholderHero
                @unknown default:
                  placeholderHero
                }
              }
              .tag(index)
            }
          }
        }
        .frame(height: 340)
        .tabViewStyle(.page(indexDisplayMode: .never))
      }
      
      // Image counter overlay (moved to top left to avoid X button)
      if availableImages.count > 1 {
        Text("\(currentImageIndex + 1) / \(availableImages.count)")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(
            Capsule()
              .fill(Color.black.opacity(0.6))
          )
          .padding(.top, 60)
          .padding(.leading, 16)
      }
    }
    .frame(height: 340)
    .overlay(alignment: .bottom) {
      if availableImages.count > 1 {
        HStack(spacing: 6) {
          ForEach(0..<availableImages.count, id: \.self) { index in
            Circle()
              .fill(currentImageIndex == index ? Color.white : Color.white.opacity(0.4))
              .frame(width: 7, height: 7)
          }
        }
        .padding(.bottom, 12)
      }
    }
  }
  
  private var placeholderHero: some View {
    ZStack {
      Rectangle()
        .fill(Color(white: 0.12))
      Image(systemName: "car.fill")
        .font(.system(size: 60))
        .foregroundStyle(Color.white.opacity(0.2))
    }
    .frame(height: 340)
  }
  
  private var aboveTheFold: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(vehicle.conditionBadge)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(Color(white: 0.18)))
      
      Text(vehicle.fullTitle)
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(.white)
      
      HStack {
        Text(vehicle.formattedPrice)
          .font(.system(size: 32, weight: .bold))
          .foregroundStyle(.white)
        
        Spacer()
        
        Button {
          // Save action
        } label: {
          HStack(spacing: 4) {
            Image(systemName: "heart")
              .font(.system(size: 16))
            Text("Save")
              .font(.system(size: 15, weight: .medium))
          }
          .foregroundStyle(.white)
        }
        
        Button {
          // Share action
        } label: {
          HStack(spacing: 4) {
            Image(systemName: "square.and.arrow.up")
              .font(.system(size: 16))
            Text("Share")
              .font(.system(size: 15, weight: .medium))
          }
          .foregroundStyle(.white)
        }
      }
      
      Text("\(vehicle.mileage.formatted()) miles")
        .font(.system(size: 16))
        .foregroundStyle(Color.white.opacity(0.7))
    }
    .padding(.top, 20)
  }
  
  private var ctaButtons: some View {
    VStack(spacing: 12) {
      Button {
        // Contact dealer action
      } label: {
        Text("Contact Dealer")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.black)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(.white)
          )
      }
      
      Button {
        // Schedule test drive action
      } label: {
        Text("Schedule Test Drive")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .stroke(.white, lineWidth: 2)
          )
      }
    }
  }
  
  private var divider: some View {
    Rectangle()
      .fill(Color.white.opacity(0.1))
      .frame(height: 1)
      .padding(.vertical, 20)
  }
  
  private var keyFeaturesGrid: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Key features")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
      
      LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
        if let bodyType = vehicle.bodyType {
          featureCard(icon: "car.fill", title: "Body Type", value: bodyType)
        }
        
        featureCard(icon: "checkmark.seal.fill", title: "Condition", value: vehicle.conditionBadge)
        
        featureCard(icon: "paintpalette.fill", title: "Exterior", value: vehicle.color)
        
        if let vin = vehicle.vin {
          featureCard(icon: "barcode", title: "VIN", value: vin)
        }
      }
    }
  }
  
  private func featureCard(icon: String, title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Image(systemName: icon)
          .font(.system(size: 18))
          .foregroundStyle(Color.orange.opacity(0.9))
        
        Text(title)
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.7))
      }
      
      Text(value)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(.white)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .fill(Color(white: 0.10))
    )
  }
  
  private var historyAndCondition: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("History and condition")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
      
      VStack(spacing: 0) {
        HStack {
          VStack(alignment: .leading, spacing: 4) {
            Text("\(vehicle.mileage.formatted())")
              .font(.system(size: 28, weight: .bold))
              .foregroundStyle(.white)
            Text("Current mileage")
              .font(.system(size: 14))
              .foregroundStyle(Color.white.opacity(0.7))
          }
          
          Spacer()
        }
        .padding(16)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(white: 0.08))
        )
      }
    }
  }
  
  private var dealerInfo: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("About the dealership")
        .font(.system(size: 22, weight: .bold))
        .foregroundStyle(.white)
      
      VStack(alignment: .leading, spacing: 12) {
        Text(vehicle.dealerName)
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(.white)
        
        if vehicle.dealerCity != nil || vehicle.dealerState != nil {
          HStack(spacing: 4) {
            Image(systemName: "mappin.circle.fill")
              .font(.system(size: 14))
              .foregroundStyle(Color.white.opacity(0.6))
            
            if let city = vehicle.dealerCity, let state = vehicle.dealerState {
              Text("\(city), \(state)")
                .font(.system(size: 15))
                .foregroundStyle(Color.white.opacity(0.8))
            } else if let city = vehicle.dealerCity {
              Text(city)
                .font(.system(size: 15))
                .foregroundStyle(Color.white.opacity(0.8))
            } else if let state = vehicle.dealerState {
              Text(state)
                .font(.system(size: 15))
                .foregroundStyle(Color.white.opacity(0.8))
            }
          }
        }
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(Color(white: 0.08))
      )
    }
  }
  
  private var bottomCTA: some View {
    VStack(spacing: 12) {
      Button {
        // Contact dealer action
      } label: {
        Text("Contact Dealer")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.black)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(.white)
          )
      }

      Button {
        // Schedule test drive action
      } label: {
        Text("Schedule Test Drive")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 14)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .stroke(.white, lineWidth: 2)
          )
      }
    }
    .padding(.top, 20)
  }

  // MARK: - Enriched sections (populated after detail fetch)

  @ViewBuilder
  private var enrichedSpecsSection: some View {
    if let d = detail, (d.drivetrain != nil || d.fuelType != nil || d.transmission != nil || d.exteriorColor != nil || d.engine != nil || d.cityMpg != nil || d.seatingCapacity != nil || d.powertrainType != nil) {
      VStack(alignment: .leading, spacing: 16) {
        Text("Specifications")
          .font(.system(size: 22, weight: .bold))
          .foregroundStyle(.white)

        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
          if let engine = d.engine {
            featureCard(icon: "wrench.fill", title: "Engine", value: engine)
          }
          if let powertrain = d.powertrainType {
            featureCard(icon: "bolt.car.fill", title: "Powertrain", value: powertrain)
          }
          if let city = d.cityMpg, let hwy = d.highwayMpg {
            featureCard(icon: "fuelpump.fill", title: "Fuel Economy", value: "\(city) city / \(hwy) hwy MPG")
          } else if let city = d.cityMpg {
            featureCard(icon: "fuelpump.fill", title: "City MPG", value: "\(city) MPG")
          } else if let hwy = d.highwayMpg {
            featureCard(icon: "fuelpump.fill", title: "Hwy MPG", value: "\(hwy) MPG")
          }
          if let seats = d.seatingCapacity {
            featureCard(icon: "person.2.fill", title: "Seating", value: "\(seats) seats")
          }
          if let drivetrain = d.drivetrain {
            featureCard(icon: "arrow.triangle.2.circlepath", title: "Drivetrain", value: drivetrain)
          }
          if let fuel = d.fuelType {
            featureCard(icon: "flame.fill", title: "Fuel Type", value: fuel)
          }
          if let trans = d.transmission {
            featureCard(icon: "gearshift.layout.sixspeed", title: "Transmission", value: trans)
          }
          if let ext = d.exteriorColor {
            featureCard(icon: "paintpalette.fill", title: "Exterior Color", value: ext)
          }
          if let interior = d.interiorColor {
            featureCard(icon: "carseat.left.fill", title: "Interior Color", value: interior)
          }
          if let dom = d.daysOnMarket {
            featureCard(icon: "calendar", title: "Days Listed", value: "\(dom) days")
          }
        }
      }
    }
  }

  @ViewBuilder
  private var sellerCommentsSection: some View {
    if let comments = detail?.sellerComments, !comments.isEmpty {
      VStack(alignment: .leading, spacing: 12) {
        Text("Seller Comments")
          .font(.system(size: 22, weight: .bold))
          .foregroundStyle(.white)

        Text(comments)
          .font(.system(size: 15))
          .foregroundStyle(Color.white.opacity(0.85))
          .padding(16)
          .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .fill(Color(white: 0.08))
          )
      }
    }
  }

  @ViewBuilder
  private var enrichedDealerSection: some View {
    if let loc = detail?.location {
      VStack(alignment: .leading, spacing: 16) {
        Text("About the dealership")
          .font(.system(size: 22, weight: .bold))
          .foregroundStyle(.white)

        VStack(alignment: .leading, spacing: 12) {
          Text(loc.dealerName)
            .font(.system(size: 18, weight: .bold))
            .foregroundStyle(.white)

          if let city = loc.dealerCity, let state = loc.dealerState {
            Label("\(city), \(state)", systemImage: "mappin.circle.fill")
              .font(.system(size: 15))
              .foregroundStyle(Color.white.opacity(0.8))
          }

          if let address = loc.dealerAddress {
            Label(address, systemImage: "building.2.fill")
              .font(.system(size: 14))
              .foregroundStyle(Color.white.opacity(0.7))
          }

          if let phone = loc.dealerPhone {
            Label(phone, systemImage: "phone.fill")
              .font(.system(size: 15))
              .foregroundStyle(Color.white.opacity(0.8))
          }

          if let rating = loc.dealerRating, let reviews = loc.dealerReviewCount {
            HStack(spacing: 4) {
              Image(systemName: "star.fill")
                .font(.system(size: 14))
                .foregroundStyle(.yellow)
              Text(String(format: "%.1f", rating))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
              Text("(\(reviews.value) reviews)")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.6))
            }
          }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(white: 0.08))
        )
      }
    }
  }

  @ViewBuilder
  private var detailLoadingIndicator: some View {
    if isLoadingDetail {
      HStack(spacing: 10) {
        ProgressView()
          .tint(.white)
        Text("Loading details…")
          .font(.system(size: 14))
          .foregroundStyle(Color.white.opacity(0.6))
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 12)
    }
  }

  // MARK: - Detail fetch

  private func loadDetail() async {
    guard !isLoadingDetail else { return }
    isLoadingDetail = true
    detailError = nil

    do {
      let fetched = try await VehicleDetailService.fetchDetail(listingId: vehicle.id)
      detail = fetched
      #if DEBUG
      FunnelLogger.shared.detailLoaded(
        photoCount: fetched.photoUrls?.count ?? 0,
        partial: fetched.partial
      )
      #endif
    } catch VehicleDetailError.quotaExceeded {
      detailError = "Monthly search limit reached."
      #if DEBUG
      FunnelLogger.shared.detailFailed(reason: "quota_exceeded")
      #endif
    } catch VehicleDetailError.notFound {
      detailError = nil // Silently degrade — show search data only
      #if DEBUG
      FunnelLogger.shared.detailFailed(reason: "listing_not_found")
      #endif
    } catch {
      detailError = nil // Network errors degrade silently
      print("⚠️ Detail fetch failed: \(error.localizedDescription)")
      #if DEBUG
      FunnelLogger.shared.detailFailed(reason: error.localizedDescription)
      #endif
    }

    isLoadingDetail = false
  }
}
